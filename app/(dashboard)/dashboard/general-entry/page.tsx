import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mSuppliers, mLedgers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GeneralEntryClient from "./GeneralEntryClient";

export default async function GeneralEntryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [journalVouchers, ledgers] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        remarks: tVouchers.remarks,
        totalAmount: tVouchers.totalAmount,
        partyCustomer: mCustomers.customerName,
        partySupplier: mSuppliers.supplierName,
      })
      .from(tVouchers)
      .leftJoin(mCustomers, eq(tVouchers.partyId, mCustomers.customerId))
      .leftJoin(mSuppliers, eq(tVouchers.partyId, mSuppliers.supplierId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "journal"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select({
        ledgerId: mLedgers.ledgerId,
        ledgerName: mLedgers.ledgerName,
        ledgerType: mLedgers.ledgerType,
      })
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
      .orderBy(mLedgers.ledgerName),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "journal" || x.accessItem === "general_entry");

  return (
    <GeneralEntryClient
      initialJournals={journalVouchers.map(jv => ({
        ...jv,
        voucherDate: jv.voucherDate ? new Date(jv.voucherDate) : null
      }))}
      ledgers={ledgers}
      canCreate={p?.c ?? false}
    />
  );
}
