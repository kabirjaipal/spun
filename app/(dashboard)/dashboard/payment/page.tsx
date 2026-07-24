import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, or, desc, ne, sql } from "drizzle-orm";
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
            eq(tVouchers.voucherType, "payment"),
            and(
              eq(tVouchers.voucherType, "receipt"),
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
        companyId: mLedgers.ledgerId,
        companyName: mLedgers.ledgerName,
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
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
    />
  );
}
