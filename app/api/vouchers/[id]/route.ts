import { db } from "@/lib/db";
import { tVouchers, tVoucherEntries, mLedgers, tVoucherItems, tStockMovements, mTaxRates, mCompanies } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const { id } = await params;
  const voucherIdNum = Number(id);
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;

  const body = await request.json();
  const {
    voucherDate,
    partyId,
    cashBankLedgerId,
    totalAmount,
    remarks,
    lrNo,
    bankName,
    paymentMethod,
    billDetails,
    isReversal,
    lineItems,
    tdsSection,
    tdsRate,
    tdsAmount,
  } = body;

  try {
    const [updatedVoucher] = await db.transaction(async (tx) => {
      const oldVoucher = await tx.query.tVouchers.findFirst({
        where: and(
          eq(tVouchers.voucherId, voucherIdNum),
          eq(tVouchers.companyId, companyId),
          isNull(tVouchers.deletedOn)
        ),
      });

      if (!oldVoucher) {
        throw new Error("Voucher not found or unauthorized");
      }

      const vType = oldVoucher.voucherType;
      let computedTotal = Number(totalAmount || 0);
      let computedTax = 0;
      let computedNet = computedTotal;

      const isNote = vType === "credit_note" || vType === "debit_note";
      let processedLines: any[] = [];

      if (isNote) {
        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error("Line items are required");
        }

        const taxRates = await tx.query.mTaxRates.findMany({
          where: isNull(mTaxRates.deletedOn),
        });

        const company = await tx.query.mCompanies.findFirst({
          where: eq(mCompanies.companyId, companyId),
        });

        const custObj = await tx.query.mCompanies.findFirst({
          where: eq(mCompanies.companyId, Number(partyId)),
        });

        const isInterstate = (() => {
          if (company?.state && custObj?.state) {
            return company.state.trim().toLowerCase() !== custObj.state.trim().toLowerCase();
          }
          if (!company?.gstNo || !custObj?.gstNo) return false;
          return company.gstNo.slice(0, 2) !== custObj.gstNo.slice(0, 2);
        })();

        computedTotal = 0;
        for (const line of lineItems) {
          const taxableAmount = Number(line.taxableAmount) || 0;
          let cgst = 0;
          let sgst = 0;
          let igst = 0;

          if (line.gstRateId) {
            const rateObj = taxRates.find((r) => String(r.taxRateId) === String(line.gstRateId));
            if (rateObj) {
              const taxPercent = Number(rateObj.taxPercent || 0);
              const totalTax = Math.round(((taxableAmount * taxPercent) / 100) * 100) / 100;
              if (isInterstate) {
                igst = totalTax;
              } else {
                cgst = Math.round((totalTax / 2) * 100) / 100;
                sgst = Math.round((totalTax - cgst) * 100) / 100;
              }
            }
          }

          const lineNet = taxableAmount + cgst + sgst + igst;
          computedTotal += taxableAmount;
          computedTax += cgst + sgst + igst;
          computedNet += lineNet;

          processedLines.push({
            ...line,
            cgst,
            sgst,
            igst,
            lineNet,
          });
        }

        computedNet = computedTotal + computedTax;
        if (tdsAmount) {
          computedNet = Math.round((computedNet - Number(tdsAmount)) * 100) / 100;
        }
      }

      // 1. Update Voucher
      const [v] = await tx
        .update(tVouchers)
        .set({
          voucherDate: voucherDate ? String(voucherDate) : undefined,
          partyId: partyId ? Number(partyId) : null,
          remarks: remarks || null,
          totalAmount: String(computedTotal),
          taxAmount: isNote ? String(computedTax) : undefined,
          netAmount: String(isNote ? computedNet : computedTotal),
          lrNo: lrNo || null,
          bankName: bankName || null,
          paymentMethod: paymentMethod || null,
          cashBankLedgerId: cashBankLedgerId ? Number(cashBankLedgerId) : null,
          billDetails: billDetails || null,
          tdsSection: tdsSection || null,
          tdsRate: tdsRate ? String(tdsRate) : null,
          tdsAmount: tdsAmount ? String(tdsAmount) : null,
          updatedBy: userId,
          updatedOn: new Date(),
        })
        .where(eq(tVouchers.voucherId, voucherIdNum))
        .returning();

      // 2. Delete existing Ledger Entries, items, stock movements
      await tx
        .delete(tVoucherEntries)
        .where(eq(tVoucherEntries.voucherId, voucherIdNum));
      await tx
        .delete(tVoucherItems)
        .where(eq(tVoucherItems.voucherId, voucherIdNum));
      await tx
        .delete(tStockMovements)
        .where(eq(tStockMovements.voucherId, voucherIdNum));

      // 3. Insert new Ledger Entries
      if (vType === "receipt") {
        if (!cashBankLedgerId || !partyId) {
          throw new Error("Cash/Bank and Party account are required for Receipts");
        }
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.ledgerId, Number(partyId)),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn)
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const bankEntryType = isReversal ? "credit" : "debit";
        const partyEntryType = isReversal ? "debit" : "credit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Party Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: partyEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (vType === "payment") {
        if (!cashBankLedgerId || !partyId) {
          throw new Error("Cash/Bank and Party account are required for Payments");
        }
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.ledgerId, Number(partyId)),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn)
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const bankEntryType = isReversal ? "debit" : "credit";
        const companyEntryType = isReversal ? "credit" : "debit";

        // Bank Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(cashBankLedgerId),
          entryType: bankEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });

        // Party Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: companyEntryType,
          amount: String(computedTotal),
          createdBy: userId,
          updatedBy: userId,
        });
      } else if (isNote) {
        const getOrCreateTaxLedger = async () => {
          let ledger = await tx.query.mLedgers.findFirst({
            where: and(
              eq(mLedgers.companyId, companyId),
              eq(mLedgers.ledgerType, "tax"),
              isNull(mLedgers.deletedOn),
            ),
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

        const ledgerTypes = ["customer", "company"];
        const partyLedger = await tx.query.mLedgers.findFirst({
          where: and(
            eq(mLedgers.referenceId, Number(partyId)),
            inArray(mLedgers.ledgerType, ledgerTypes),
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
          ),
        });
        if (!partyLedger) throw new Error("Party ledger not found");

        const companyEntryType = vType === "credit_note" ? "credit" : "debit";
        const taxEntryType = vType === "credit_note" ? "debit" : "credit";

        // Party Entry
        await tx.insert(tVoucherEntries).values({
          voucherId: voucherIdNum,
          ledgerId: Number(partyLedger.ledgerId),
          entryType: companyEntryType,
          amount: String(computedNet),
          createdBy: userId,
          updatedBy: userId,
        });

        // Insert item details, ledger postings
        for (const line of processedLines) {
          await tx.insert(tVoucherItems).values({
            voucherId: voucherIdNum,
            ledgerId: line.ledgerId ? Number(line.ledgerId) : null,
            hsnCode: line.hsnCode || null,
            pcs: 0,
            quantity: "0",
            fold: "100.00",
            rate: "0.00",
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: String(line.taxableAmount),
            cgst: String(line.cgst),
            sgst: String(line.sgst),
            igst: String(line.igst),
            netAmount: String(line.lineNet),
            createdBy: userId,
            updatedBy: userId,
          });

          // Credit / Debit Revenue Account
          const lineLedgerId = Number(line.ledgerId) || 0;
          if (lineLedgerId) {
            await tx.insert(tVoucherEntries).values({
              voucherId: voucherIdNum,
              ledgerId: lineLedgerId,
              entryType: vType === "credit_note" ? "debit" : "credit",
              amount: String(line.taxableAmount),
              createdBy: userId,
              updatedBy: userId,
            });
          }

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
        }
      }

      // 4. Log Audit Trail
      await writeAuditLog(tx, {
        tableName: "t_vouchers",
        recordId: voucherIdNum,
        actionType: "update",
        oldDataJson: oldVoucher,
        newDataJson: v,
        createdBy: userId,
      });

      return [v];
    });

    return NextResponse.json(updatedVoucher);
  } catch (error: any) {
    console.error("Voucher update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update voucher" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const { id } = await params;
  const voucherIdNum = Number(id);
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;

  try {
    const deletedVoucher = await db.transaction(async (tx) => {
      const oldVoucher = await tx.query.tVouchers.findFirst({
        where: and(
          eq(tVouchers.voucherId, voucherIdNum),
          eq(tVouchers.companyId, companyId),
          isNull(tVouchers.deletedOn)
        ),
      });

      if (!oldVoucher) {
        throw new Error("Voucher not found or unauthorized");
      }

      // Soft delete
      const [v] = await tx
        .update(tVouchers)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVouchers.voucherId, voucherIdNum))
        .returning();

      await tx
        .update(tVoucherEntries)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVoucherEntries.voucherId, voucherIdNum));

      await tx
        .update(tVoucherItems)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tVoucherItems.voucherId, voucherIdNum));

      await tx
        .update(tStockMovements)
        .set({
          deletedOn: new Date(),
          deletedBy: userId,
        })
        .where(eq(tStockMovements.voucherId, voucherIdNum));

      // Log Audit Trail
      await writeAuditLog(tx, {
        tableName: "t_vouchers",
        recordId: voucherIdNum,
        actionType: "delete",
        oldDataJson: oldVoucher,
        newDataJson: null,
        createdBy: userId,
      });

      return [v];
    });

    return NextResponse.json({ success: true, voucher: deletedVoucher });
  } catch (error: any) {
    console.error("Voucher delete error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete voucher" },
      { status: 500 }
    );
  }
}
