import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, or, desc, ne, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ReceiptClient from "./ReceiptClient";

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;
  const editId = params.editId ? Number(params.editId) : undefined;

  const [receipts, parties, cashBankLedgers] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        remarks: tVouchers.remarks,
        partyName: mLedgers.ledgerName,
        lrNo: tVouchers.lrNo,
        bankName: tVouchers.bankName,
        paymentMethod: tVouchers.paymentMethod,
        cashBankLedgerId: tVouchers.cashBankLedgerId,
        billDetails: tVouchers.billDetails,
        voucherType: tVouchers.voucherType,
      })
      .from(tVouchers)
      .leftJoin(mLedgers, eq(tVouchers.partyId, mLedgers.ledgerId))
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          or(
            eq(tVouchers.voucherType, "receipt"),
            and(
              eq(tVouchers.voucherType, "payment"),
              sql`${tVouchers.remarks} LIKE '%[RETURN CHEQUE REVERSAL]%'`
            )
          ),
          isNull(tVouchers.deletedOn)
        )
      )
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select({
        partyId: mLedgers.ledgerId,
        partyName: mLedgers.ledgerName,
      })
      .from(mLedgers)
      .where(
        and(
          eq(mLedgers.companyId, companyId),
          isNull(mLedgers.deletedOn),
          ne(mLedgers.ledgerType, "cash"),
          ne(mLedgers.ledgerType, "bank")
        )
      )
      .orderBy(mLedgers.ledgerName),
    db
      .select({
        ledgerId: mLedgers.ledgerId,
        ledgerName: mLedgers.ledgerName,
        ledgerType: mLedgers.ledgerType,
      })
      .from(mLedgers)
      .where(
        and(
          eq(mLedgers.companyId, companyId),
          isNull(mLedgers.deletedOn),
          or(eq(mLedgers.ledgerType, "cash"), eq(mLedgers.ledgerType, "bank"))
        )
      )
      .orderBy(mLedgers.ledgerName),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "receipt");

  let initialEditVoucher: any = null;
  if (editId) {
    const existing = receipts.find(r => r.voucherId === editId);
    if (existing) {
      initialEditVoucher = {
        ...existing,
        voucherDate: existing.voucherDate ? new Date(existing.voucherDate) : null
      };
    } else {
      const ev = await db.query.tVouchers.findFirst({
        where: and(eq(tVouchers.voucherId, editId), eq(tVouchers.companyId, companyId)),
      });
      if (ev) {
        const ledger = await db.query.mLedgers.findFirst({
          where: eq(mLedgers.ledgerId, ev.partyId || 0),
        });
        initialEditVoucher = {
          voucherId: ev.voucherId,
          voucherNo: ev.voucherNo,
          voucherDate: ev.voucherDate ? new Date(ev.voucherDate) : null,
          partyId: ev.partyId,
          totalAmount: ev.totalAmount,
          remarks: ev.remarks,
          partyName: ledger?.ledgerName || null,
          lrNo: ev.lrNo,
          bankName: ev.bankName,
          paymentMethod: ev.paymentMethod,
          cashBankLedgerId: ev.cashBankLedgerId,
          billDetails: ev.billDetails,
          voucherType: ev.voucherType,
        };
      }
    }
  }

  return (
    <ReceiptClient
      initialReceipts={receipts.map(r => ({
        ...r,
        voucherDate: r.voucherDate ? new Date(r.voucherDate) : null
      }))}
      parties={parties}
      cashBankLedgers={cashBankLedgers}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      initialEditVoucher={initialEditVoucher}
    />
  );
}
