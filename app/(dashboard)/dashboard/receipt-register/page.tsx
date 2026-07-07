import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, tVouchers, tVoucherEntries, mLedgers } from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ReceiptRegisterClient from "./ReceiptRegisterClient";

export default async function ReceiptRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  const company = await db.select().from(mCompanies).where(eq(mCompanies.companyId, companyId)).limit(1).then(r => r[0]);
  if (!company) redirect("/setup-company");

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  const receiptVouchers = await db
    .select({ voucherId: tVouchers.voucherId, voucherNo: tVouchers.voucherNo, voucherDate: tVouchers.voucherDate, voucherType: tVouchers.voucherType, netAmount: tVouchers.netAmount, remarks: tVouchers.remarks, status: tVouchers.status })
    .from(tVouchers)
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "receipt"), isNull(tVouchers.deletedOn), gte(tVouchers.voucherDate, fromDate), lte(tVouchers.voucherDate, toDate)))
    .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);

  const voucherIds = receiptVouchers.map(v => v.voucherId);

  let dbEntries: any[] = [];
  if (voucherIds.length > 0) {
    dbEntries = await db
      .select({ voucherId: tVoucherEntries.voucherId, entryId: tVoucherEntries.voucherEntryId, entryType: tVoucherEntries.entryType, amount: tVoucherEntries.amount, ledgerId: tVoucherEntries.ledgerId, ledgerName: mLedgers.ledgerName })
      .from(tVoucherEntries)
      .leftJoin(mLedgers, eq(tVoucherEntries.ledgerId, mLedgers.ledgerId))
      .where(inArray(tVoucherEntries.voucherId, voucherIds));
  }

  const vouchersMap = new Map<number, any>();
  receiptVouchers.forEach(v => {
    vouchersMap.set(v.voucherId, { voucherId: v.voucherId, voucherNo: v.voucherNo, voucherType: v.voucherType, voucherDate: v.voucherDate, netAmount: Number(v.netAmount), remarks: v.remarks, status: v.status, entries: [] });
  });
  dbEntries.forEach(e => {
    const v = vouchersMap.get(e.voucherId);
    if (v) v.entries.push({ entryId: e.entryId, entryType: e.entryType, amount: Number(e.amount), ledgerId: e.ledgerId, ledgerName: e.ledgerName || "Unknown Ledger" });
  });

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const canExport = perms.find(x => x.accessItem === "receipt_register")?.e ?? false;

  return (
    <ReceiptRegisterClient
      company={{ companyId: company.companyId, companyName: company.companyName, gstNo: company.gstNo, address: company.address }}
      vouchers={Array.from(vouchersMap.values())}
      canExport={canExport}
    />
  );
}
