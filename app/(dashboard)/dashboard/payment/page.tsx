import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mLedgers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, or, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PaymentClient from "./PaymentClient";

export default async function PaymentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [payments, companies, cashBankLedgers] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        remarks: tVouchers.remarks,
        partyName: mCompanies.companyName,
        lrNo: tVouchers.lrNo,
        bankName: tVouchers.bankName,
        paymentMethod: tVouchers.paymentMethod,
      })
      .from(tVouchers)
      .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "payment"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select({
        companyId: mCompanies.companyId,
        companyName: mCompanies.companyName,
      })
      .from(mCompanies)
      .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
      .orderBy(mCompanies.companyName),
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
  const p = perms.find((x) => x.accessItem === "payment");

  return (
    <PaymentClient
      initialPayments={payments.map(py => ({
        ...py,
        voucherDate: py.voucherDate ? new Date(py.voucherDate) : null
      }))}
      companies={companies.map(c => ({
        companyId: c.companyId,
        companyName: c.companyName
      }))}
      cashBankLedgers={cashBankLedgers}
      canCreate={p?.c ?? false}
    />
  );
}
