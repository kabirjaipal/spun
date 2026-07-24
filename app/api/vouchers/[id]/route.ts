import { db } from "@/lib/db";
import { tVouchers, tVoucherEntries, mLedgers } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
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
      const computedTotal = Number(totalAmount || 0);

      // 1. Update Voucher
      const [v] = await tx
        .update(tVouchers)
        .set({
          voucherDate: voucherDate ? String(voucherDate) : undefined,
          partyId: partyId ? Number(partyId) : null,
          remarks: remarks || null,
          totalAmount: String(computedTotal),
          netAmount: String(computedTotal),
          lrNo: lrNo || null,
          bankName: bankName || null,
          paymentMethod: paymentMethod || null,
          cashBankLedgerId: cashBankLedgerId ? Number(cashBankLedgerId) : null,
          billDetails: billDetails || null,
          updatedBy: userId,
          updatedOn: new Date(),
        })
        .where(eq(tVouchers.voucherId, voucherIdNum))
        .returning();

      // 2. Delete existing Ledger Entries
      await tx
        .delete(tVoucherEntries)
        .where(eq(tVoucherEntries.voucherId, voucherIdNum));

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
