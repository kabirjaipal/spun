import { db } from "@/lib/db";
import { mLedgers, mProducts, mTaxRates, mCustomers, mSuppliers, mJobs, mMills, mCompanies, tVouchers, tVoucherEntries, tStockMovements, tVoucherItems } from "@/lib/db/schema";
import { and, eq, isNull, desc, sql, inArray } from "drizzle-orm";
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
  const {
    voucherType,
    voucherNo,
    voucherDate,
    partyId,
    remarks,
    lineItems,
    cashBankLedgerId,
    totalAmount,
    broker,
    haste,
    lrNo,
    lrDate,
    transport,
    vehicleNo,
    personName,
    lotNo,
    printRate = true,
    printAmount = true,
    parentVoucherId,
    billDetails,
    isReversal
  } = body;

  if (!voucherType || !voucherNo || !voucherDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const [voucher] = await db.transaction(async (tx) => {
      // Determine interstate vs intrastate GST based on GSTIN prefix
      const company = await tx.query.mCompanies.findFirst({
        where: eq(mCompanies.companyId, companyId),
      });
      const companyGst = company?.gstNo || "";
      let partyGstNo = "";

      if (partyId) {
        if (voucherType === "sale" || voucherType === "credit_note" || voucherType === "debit_note") {
          const cust = await tx.query.mCustomers.findFirst({
            where: eq(mCustomers.customerId, Number(partyId)),
          });
          partyGstNo = cust?.gstNo || "";
        } else if (voucherType === "purchase") {
          const supp = await tx.query.mSuppliers.findFirst({
            where: eq(mSuppliers.supplierId, Number(partyId)),
          });
          partyGstNo = supp?.gstNo || "";
        } else if (voucherType === "job_outward" || voucherType === "job_inward") {
          const job = await tx.query.mJobs.findFirst({
            where: eq(mJobs.jobId, Number(partyId)),
          });
          partyGstNo = job?.gstNo || "";
        } else if (voucherType === "mill_outward" || voucherType === "mill_inward") {
          const mill = await tx.query.mMills.findFirst({
            where: eq(mMills.millId, Number(partyId)),
          });
          partyGstNo = mill?.gstNo || "";
        }
      }

      const isInterstate = companyGst && partyGstNo && companyGst.slice(0, 2) !== partyGstNo.slice(0, 2);

      // Calculate totals based on voucher type
      let computedTotal = 0;
      let computedTax = 0;
      let computedNet = 0;

      const processedLines: any[] = [];

      if (
        voucherType === "sale" ||
        voucherType === "purchase" ||
        voucherType === "credit_note" ||
        voucherType === "debit_note" ||
        voucherType === "job_outward" ||
        voucherType === "job_inward" ||
        voucherType === "mill_outward" ||
        voucherType === "mill_inward" ||
        voucherType === "direct_bill"
      ) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required for this voucher type");
        }

        for (const line of lineItems) {
          const qty = Number(line.quantity) || 0;
          const rate = Number(line.rate) || 0;
          const fold = Number(line.fold !== undefined ? line.fold : 100) || 100;
          
          // Fold formula: quantity * rate * fold / 100
          const taxableAmount = Math.round((qty * rate * fold / 100) * 100) / 100;

          let cgst = 0;
          let sgst = 0;
          let igst = 0;

          if (line.gstRateId) {
            const taxRate = await tx.query.mTaxRates.findFirst({ where: eq(mTaxRates.taxRateId, Number(line.gstRateId)) });
            if (taxRate) {
              const taxPercent = Number(taxRate.taxPercent || 0);
              const totalTax = Math.round((taxableAmount * taxPercent) / 100 * 100) / 100;
              if (isInterstate) {
                igst = totalTax;
              } else {
                cgst = Math.round((totalTax / 2) * 100) / 100;
                sgst = Math.round((totalTax - cgst) * 100) / 100;
              }
            }
          }

          const lineTax = cgst + sgst + igst;
          const lineNet = taxableAmount + lineTax;

          computedTotal += taxableAmount;
          computedTax += lineTax;
          computedNet += lineNet;

          processedLines.push({
            ...line,
            qty,
            rate,
            fold,
            taxableAmount,
            cgst,
            sgst,
            igst,
            lineNet,
          });
        }
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
          broker: broker || null,
          haste: haste || null,
          lrNo: lrNo || null,
          lrDate: lrDate ? String(lrDate) : null,
          transport: transport || null,
          vehicleNo: vehicleNo || null,
          personName: personName || null,
          lotNo: lotNo || null,
          printRate: printRate,
          printAmount: printAmount,
          parentVoucherId: parentVoucherId ? Number(parentVoucherId) : null,
          cashBankLedgerId: cashBankLedgerId ? Number(cashBankLedgerId) : null,
          billDetails: billDetails || null,
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

      // Insert Entries and Stock Movements
      if (voucherType === "sale" || voucherType === "credit_note") {
        // 1. Debit Customer Ledger
        const customerLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "customer"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!customerLedger) throw new Error("Customer ledger not found");

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(customerLedger.ledgerId),
          entryType: voucherType === "sale" ? "debit" : "credit",
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Insert item details, ledger postings, and stock movements
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            productId: Number(line.productId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Credit / Debit Revenue Account
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(line.ledgerId),
            entryType: voucherType === "sale" ? "credit" : "debit",
            amount: String(line.taxableAmount),
            createdBy: userId,
            updatedBy: userId,
          });

          // Tax Ledger Entries
          const taxLedger = await getOrCreateTaxLedger();
          const totalLineTax = line.cgst + line.sgst + line.igst;
          if (totalLineTax > 0) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: Number(taxLedger.ledgerId),
              entryType: voucherType === "sale" ? "credit" : "debit",
              amount: String(totalLineTax),
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Stock movements
          const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
          if (product) {
            await tx.insert(tStockMovements).values({
              companyId,
              productId: Number(product.productId),
              voucherId: voucherIdNum,
              movementType: voucherType === "sale" ? "sale" : "adjustment",
              quantity: String(voucherType === "sale" ? line.qty : -line.qty),
              rate: String(line.rate),
              amount: String(line.taxableAmount),
              createdBy: userId,
              updatedBy: userId,
            });
          }
        }
      } else if (voucherType === "purchase" || voucherType === "debit_note" || voucherType === "direct_bill") {
        // 1. Credit Supplier Ledger
        const supplierLedger = await tx.query.mLedgers.findFirst({
          where: and(eq(mLedgers.referenceId, Number(partyId)), eq(mLedgers.ledgerType, "supplier"), eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))
        });
        if (!supplierLedger) throw new Error("Supplier ledger not found");

        const supplierEntryType = (voucherType === "purchase" || voucherType === "direct_bill") ? "credit" : "debit";
        const expenseEntryType = (voucherType === "purchase" || voucherType === "direct_bill") ? "debit" : "credit";
        const taxEntryType = (voucherType === "purchase" || voucherType === "direct_bill") ? "debit" : "credit";

        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(supplierLedger.ledgerId),
          entryType: supplierEntryType,
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // 2. Insert item details, ledger postings, and stock movements
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            productId: Number(line.productId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Expense Account Entry
          await tx.insert(tVoucherEntries).values({
            voucherId: voucherIdNum,
            ledgerId: Number(line.ledgerId),
            entryType: expenseEntryType,
            amount: String(line.taxableAmount),
            createdBy: userId,
            updatedBy: userId,
          });

          // Tax Ledger Entries
          const taxLedger = await getOrCreateTaxLedger();
          const totalLineTax = line.cgst + line.sgst + line.igst;
          if (totalLineTax > 0) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: Number(taxLedger.ledgerId),
              entryType: taxEntryType,
              amount: String(totalLineTax),
              createdBy: userId,
              updatedBy: userId,
            });
          }

          // Stock movements (Only for standard trading purchases, not direct non-trading bills)
          if (voucherType !== "direct_bill") {
            const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
            if (product) {
              await tx.insert(tStockMovements).values({
                companyId,
                productId: Number(product.productId),
                voucherId: voucherIdNum,
                movementType: voucherType === "purchase" ? "purchase" : "adjustment",
                quantity: String(voucherType === "purchase" ? line.qty : -line.qty),
                rate: String(line.rate),
                amount: String(line.taxableAmount),
                createdBy: userId,
                updatedBy: userId,
              });
            }
          }
        }
      } else if (
        voucherType === "job_outward" ||
        voucherType === "job_inward" ||
        voucherType === "mill_outward" ||
        voucherType === "mill_inward"
      ) {
        // Job work and mill movements. These represent stock transfers/adjustments.
        // We write to tVoucherItems and record stock movements without ledger double-entries.
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            productId: Number(line.productId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode || null,
            pcs: Number(line.pcs || 0),
            quantity: String(line.qty),
            fold: String(line.fold),
            rate: String(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            jobType: line.jobType || null,
            jobRateType: line.jobRateType || null,
            createdBy: userId,
            updatedBy: userId,
          });

          // Stock movements
          const product = await tx.query.mProducts.findFirst({ where: eq(mProducts.productId, Number(line.productId)) });
          if (product) {
            let movementTypeStr = "adjustment";
            let movementQty = line.qty;

            if (voucherType === "job_outward" || voucherType === "mill_outward") {
              // Outward sends raw/grey stock out
              movementQty = -line.qty;
            } else {
              // Inward returns finished stock in
              movementQty = line.qty;
            }

            await tx.insert(tStockMovements).values({
              companyId,
              productId: Number(product.productId),
              voucherId: voucherIdNum,
              movementType: movementTypeStr,
              quantity: String(movementQty),
              rate: String(line.rate),
              amount: String(line.taxableAmount),
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

        const bankEntryType = isReversal ? "credit" : "debit";
        const customerEntryType = isReversal ? "debit" : "credit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Customer Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(customerLedger.ledgerId),
          entryType: customerEntryType,
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

        const bankEntryType = isReversal ? "debit" : "credit";
        const supplierEntryType = isReversal ? "credit" : "debit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Supplier Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(supplierLedger.ledgerId),
          entryType: supplierEntryType,
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


export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const companyId = Number(session.user.companyId);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "sale";
  const partyId = searchParams.get("partyId");
  const includeItems = searchParams.get("includeItems") === "true";

  if (type === "outstanding") {
    if (!partyId) return NextResponse.json({ error: "partyId is required" }, { status: 400 });
    const pId = Number(partyId);
    
    const customer = await db.query.mCustomers.findFirst({
      where: and(eq(mCustomers.customerId, pId), eq(mCustomers.companyId, companyId))
    });
    const supplier = await db.query.mSuppliers.findFirst({
      where: and(eq(mSuppliers.supplierId, pId), eq(mSuppliers.companyId, companyId))
    });

    if (!customer && !supplier) {
      return NextResponse.json([]);
    }

    const isCustomer = !!customer;
    const invoiceType = isCustomer ? "sale" : "purchase";
    const paymentType = isCustomer ? "receipt" : "payment";
    const noteType = isCustomer ? "credit_note" : "debit_note";

    const invoices = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        netAmount: tVouchers.netAmount,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          eq(tVouchers.voucherType, invoiceType),
          eq(tVouchers.partyId, pId),
          isNull(tVouchers.deletedOn)
        )
      )
      .orderBy(desc(tVouchers.voucherDate));

    const adjustments = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherType: tVouchers.voucherType,
        billDetails: tVouchers.billDetails,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          inArray(tVouchers.voucherType, [paymentType, noteType]),
          eq(tVouchers.partyId, pId),
          isNull(tVouchers.deletedOn)
        )
      );

    const paidAmounts: Record<number, number> = {};
    for (const adj of adjustments) {
      if (adj.billDetails && Array.isArray(adj.billDetails)) {
        for (const item of adj.billDetails) {
          if (item && typeof item === "object" && "voucherId" in item) {
            const vId = Number(item.voucherId);
            const amt = Number(item.amount) || 0;
            paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
          }
        }
      }
    }

    const ledger = await db.query.mLedgers.findFirst({
      where: and(
        eq(mLedgers.referenceId, pId),
        eq(mLedgers.ledgerType, isCustomer ? "customer" : "supplier"),
        eq(mLedgers.companyId, companyId),
        isNull(mLedgers.deletedOn)
      )
    });

    const outstandingInvoices = invoices
      .map((inv) => {
        const netAmt = Number(inv.netAmount) || 0;
        const paidAmt = paidAmounts[Number(inv.voucherId)] || 0;
        const outstanding = Math.max(0, netAmt - paidAmt);
        return {
          ...inv,
          netAmount: netAmt,
          paidAmount: paidAmt,
          outstanding: Math.round(outstanding * 100) / 100,
          rateOfInterest: ledger ? Number(ledger.rateOfInterest || 0) : 0,
          creditDays: ledger ? Number(ledger.creditDays || 0) : 0,
        };
      })
      .filter((inv) => inv.outstanding > 0.01);

    return NextResponse.json(outstandingInvoices);
  }

  const conditions = [
    eq(tVouchers.companyId, companyId),
    eq(tVouchers.voucherType, type),
    isNull(tVouchers.deletedOn),
  ];

  if (partyId) {
    conditions.push(eq(tVouchers.partyId, Number(partyId)));
  }

  const query = db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      voucherType: tVouchers.voucherType,
      status: tVouchers.status,
      totalAmount: tVouchers.totalAmount,
      taxAmount: tVouchers.taxAmount,
      netAmount: tVouchers.netAmount,
      remarks: tVouchers.remarks,
      partyId: tVouchers.partyId,
      billDetails: tVouchers.billDetails,
      broker: tVouchers.broker,
      haste: tVouchers.haste,
      lrNo: tVouchers.lrNo,
      lrDate: tVouchers.lrDate,
      transport: tVouchers.transport,
      vehicleNo: tVouchers.vehicleNo,
      personName: tVouchers.personName,
      lotNo: tVouchers.lotNo,
      parentVoucherId: tVouchers.parentVoucherId,
      cashBankLedgerId: tVouchers.cashBankLedgerId,
      customerName: mCustomers.customerName,
      customerGst: mCustomers.gstNo,
      customerAddress: mCustomers.address,
      supplierName: mSuppliers.supplierName,
      supplierGst: mSuppliers.gstNo,
      supplierAddress: mSuppliers.address,
      jobName: mJobs.jobName,
      jobGst: mJobs.gstNo,
      jobAddress: mJobs.address,
      millName: mMills.millName,
      millGst: mMills.gstNo,
      millAddress: mMills.address,
    })
    .from(tVouchers)
    .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
    .leftJoin(mSuppliers, eq(tVouchers.partyId, mSuppliers.supplierId))
    .leftJoin(mJobs, eq(tVouchers.partyId, mJobs.jobId))
    .leftJoin(mMills, eq(tVouchers.partyId, mMills.millId))
    .where(and(...conditions))
    .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId));

  const vouchers = await query;

  if (includeItems && vouchers.length > 0) {
    const voucherIds = vouchers.map((v) => Number(v.voucherId));
    // Fetch items for these vouchers
    const items = await db
      .select({
        voucherItemId: tVoucherItems.voucherItemId,
        voucherId: tVoucherItems.voucherId,
        productId: tVoucherItems.productId,
        productName: mProducts.productName,
        productCode: mProducts.productCode,
        unit: mProducts.unit,
        ledgerId: tVoucherItems.ledgerId,
        hsnCode: tVoucherItems.hsnCode,
        pcs: tVoucherItems.pcs,
        quantity: tVoucherItems.quantity,
        fold: tVoucherItems.fold,
        rate: tVoucherItems.rate,
        gstRateId: tVoucherItems.gstRateId,
        taxableAmount: tVoucherItems.taxableAmount,
        cgst: tVoucherItems.cgst,
        sgst: tVoucherItems.sgst,
        igst: tVoucherItems.igst,
        netAmount: tVoucherItems.netAmount,
      })
      .from(tVoucherItems)
      .leftJoin(mProducts, eq(tVoucherItems.productId, mProducts.productId))
      .where(and(isNull(tVoucherItems.deletedOn)));

    const itemsGrouped = items.reduce((acc: any, item) => {
      const vId = Number(item.voucherId);
      if (!acc[vId]) acc[vId] = [];
      acc[vId].push(item);
      return acc;
    }, {});

    const vouchersWithItems = vouchers.map((v) => ({
      ...v,
      lineItems: itemsGrouped[Number(v.voucherId)] || [],
    }));

    return NextResponse.json(vouchersWithItems);
  }

  return NextResponse.json(vouchers);
}
