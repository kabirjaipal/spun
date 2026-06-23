import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mLedgers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, or, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ReceiptClient from "./ReceiptClient";

export default async function ReceiptPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [receipts, customers, cashBankLedgers] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        remarks: tVouchers.remarks,
        customerName: mCustomers.customerName,
      })
      .from(tVouchers)
      .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "receipt"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select({
        customerId: mCustomers.customerId,
        customerName: mCustomers.customerName,
      })
      .from(mCustomers)
      .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn)))
      .orderBy(mCustomers.customerName),
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

  return (
    <ReceiptClient
      initialReceipts={receipts.map(r => ({
        ...r,
        voucherDate: r.voucherDate ? new Date(r.voucherDate) : null
      }))}
      customers={customers}
      cashBankLedgers={cashBankLedgers}
      canCreate={p?.c ?? false}
    />
  );
}
