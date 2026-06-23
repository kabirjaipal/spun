import { db } from "@/lib/db";
import { mLedgers, mProducts, mTaxRates, mCustomers, mSuppliers, tVouchers, tVoucherEntries, tStockMovements } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const userId = session.user.id;
  const companyId = Number(session.user.companyId);
  const body = await request.json();
  const { voucherType, voucherNo, voucherDate, partyId, remarks, lineItems, cashBankLedgerId, totalAmount } = body;

  if (!voucherType || !voucherNo || !voucherDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const [voucher] = await db.transaction(async (tx) => {
      // Calculate totals based on voucher type
      let computedTotal = 0;
      let computedTax = 0;
      let computedNet = 0;

      if (voucherType === "sale" || voucherType === "purchase") {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required for sales and purchases");
        }
        computedTotal = lineItems.reduce((sum: number, line: any) => sum + ((Number(line.quantity) || 0) * (Number(line.rate) || 0)), 0);
        computedTax = lineItems.reduce((sum: number, line: any) => {
          const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
          const gstRate = Number(line.gstRateId || 0);
          return sum + Math.round((amount * gstRate) / 100 * 100) / 100;
        }, 0);
        computedNet = computedTotal + computedTax;
      } else if (voucherType === "receipt" || voucherType === "payment") {
        computedTotal = Number(totalAmount || 0);
        computedNet = computedTotal;
      } else if (voucherType === "journal") {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required for journal vouchers");
        }
        const debits = lineItems.filter((l: any) => l.entryType === "debit").reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
        const credits = lineItems.filter((l: any) => l.entryType === "credit").reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
        if (Math.abs(debits - credits) > 0.01) {
          throw new Error("Debits and credits do not balance in journal voucher");
        }
        computedTotal = debits;
        computedNet = debits;
      }

      // Insert Voucher Summary
      const [createdVoucher] = await tx
        .insert(tVouchers)
        .values({
          companyId,
          voucherType,
          voucherNo,
          voucherDate: String(voucherDate),
          partyId: partyId ? Number(partyId) : null,
          remarks: remarks || null,
          status: "posted",
          totalAmount: String(computedTotal),
          taxAmount: String(computedTax),
          netAmount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const voucherIdNum = Number(createdVoucher.voucherId);

      // Helper to find or create a Tax/GST ledger
      const getOrCreateTaxLedger = async () => {
        let ledger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.companyId, companyId), eq(mLedgers.ledgerType, "tax"), isNull(mLedgers.deletedOn)),
        });
        if (!ledger) {
          const [newL] = await tx
            .insert(mLedgers)
            .values({
              companyId,
              ledgerName: "GST Tax Paid/Collected",
              ledgerType: "tax",
              createdBy: userId,
              updatedBy: userId,
            })
            .returning();
          ledger = newL;
        }
        return ledger;
      };

      // Insert Entries
      if (voucherType === "sale") {
        // 1. Debit Customer Ledger
        const customerLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "customer"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!customerLedger) throw new Error("Customer ledger not found");

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(customerLedger.ledgerId),
          entryType: "debit",
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Credit Sales / Tax ledgers
        for (const line of lineItems) {
          const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
          // Credit Revenue/Sales Account
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(line.ledgerId),
            entryType: "credit",
            amount: String(amount),
            createdBy: userId,
            updatedBy: userId,
          });

          // Credit Tax Ledger if GST is applicable
          if (line.gstRateId) {
            const taxRate = await tx.query.mTaxRates.findFirst({ where: eq(mTaxRates.taxRateId, Number(line.gstRateId)) });
            if (taxRate) {
              const taxPercent = Number(taxRate.taxPercent || 0);
              const taxAmount = Math.round((amount * taxPercent) / 100 * 100) / 100;
              if (taxAmount > 0) {
                const taxLedger = await getOrCreateTaxLedger();
                await tx.insert(tVoucherEntries).values({
                  voucherId: voucherIdNum,
                  ledgerId: Number(taxLedger.ledgerId),
                  entryType: "credit",
                  amount: String(taxAmount),
                  createdBy: userId,
                  updatedBy: userId,
                });
              }
            }
          }

          // Stock movements
          const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
          if (product) {
            await tx.insert(tStockMovements).values({
              companyId,
              productId: Number(product.productId),
              voucherId: voucherIdNum,
              movementType: "sale",
              quantity: String(Number(line.quantity) || 0),
              rate: String(Number(line.rate) || 0),
              amount: String(amount),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
      } else if (voucherType === "purchase") {
        // 1. Credit Supplier Ledger
        const supplierLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "supplier"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!supplierLedger) throw new Error("Supplier ledger not found");

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(supplierLedger.ledgerId),
          entryType: "credit",
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Debit Purchase / Tax ledgers
        for (const line of lineItems) {
          const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
          // Debit Purchase/Expense Account
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(line.ledgerId),
            entryType: "debit",
            amount: String(amount),
            createdBy: userId,
            updatedBy: userId,
          });

          // Debit Tax Ledger if GST is applicable
          if (line.gstRateId) {
            const taxRate = await tx.query.mTaxRates.findFirst({ where: eq(mTaxRates.taxRateId, Number(line.gstRateId)) });
            if (taxRate) {
              const taxPercent = Number(taxRate.taxPercent || 0);
              const taxAmount = Math.round((amount * taxPercent) / 100 * 100) / 100;
              if (taxAmount > 0) {
                const taxLedger = await getOrCreateTaxLedger();
                await tx.insert(tVoucherEntries).values({
                  voucherId: voucherIdNum,
                  ledgerId: Number(taxLedger.ledgerId),
                  entryType: "debit",
                  amount: String(taxAmount),
                  createdBy: userId,
                  updatedBy: userId,
                });
              }
            }
          }

          // Stock movements
          const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
          if (product) {
            await tx.insert(tStockMovements).values({
              companyId,
              productId: Number(product.productId),
              voucherId: voucherIdNum,
              movementType: "purchase",
              quantity: String(Number(line.quantity) || 0),
              rate: String(Number(line.rate) || 0),
              amount: String(amount),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
      } else if (voucherType === "receipt") {
        if (!cashBankLedgerId || !partyId) throw new Error("Cash/Bank and Customer account are required for Receipts");
        const customerLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "customer"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!customerLedger) throw new Error("Customer ledger not found");

        // Debit cash/bank
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: "debit",
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Credit customer
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(customerLedger.ledgerId),
          entryType: "credit",
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (voucherType === "payment") {
        if (!cashBankLedgerId || !partyId) throw new Error("Cash/Bank and Supplier account are required for Payments");
        const supplierLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "supplier"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!supplierLedger) throw new Error("Supplier ledger not found");

        // Credit cash/bank
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: "credit",
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Debit supplier
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(supplierLedger.ledgerId),
          entryType: "debit",
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (voucherType === "journal") {
        for (const entry of lineItems) {
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(entry.ledgerId),
            entryType: entry.entryType,
            amount: String(entry.amount),
            createdBy: userId,
            updatedBy: userId,
          });
        }
      }

      // Log Audit Event
      await writeAuditLog(tx, {
        tableName: "t_vouchers",
        recordId: voucherIdNum,
        actionType: "create",
        newDataJson: createdVoucher,
        createdBy: userId,
      });

      return [createdVoucher];
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (error: any) {
    console.error("Voucher error:", error);
    return NextResponse.json({ error: error.message || "Failed to create voucher" }, { status: 500 });
  }
}
