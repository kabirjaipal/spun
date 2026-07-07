import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mLedgers, mLedgerGroups, tVouchers, tVoucherEntries } from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import BudgetVsActualsClient from "./BudgetVsActualsClient";

export default async function BudgetVsActualsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // Fetch Ledger Groups
  const groups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // Fetch Ledgers with live balances
  const ledgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
      debit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
    })
    .from(mLedgers)
    .leftJoin(
      tVoucherEntries,
      eq(mLedgers.ledgerId, tVoucherEntries.ledgerId)
    )
    .leftJoin(
      tVouchers,
      and(
        eq(tVoucherEntries.voucherId, tVouchers.voucherId),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId)
    .orderBy(mLedgers.ledgerName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const canExport = perms.find((x) => x.accessItem === "budget_vs_actuals")?.e ?? false;

  return (
    <BudgetVsActualsClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      groups={groups}
      ledgers={ledgers.map((l) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        ledgerType: l.ledgerType,
        groupId: l.groupId,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))}
      canExport={canExport}
    />
  );
}
