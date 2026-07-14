import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVoucherEntries,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, sql, gte, lte } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import TrialBalanceClient from "./TrialBalanceClient";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  // 1. Fetch Company Info
  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  // Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 2. Fetch Ledger Groups
  const groups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // 3. Fetch Ledgers with opening and period balances
  const ledgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
      openingDebit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' and ${tVouchers.voucherId} is not null and ${tVouchers.voucherDate} < ${fromDate} then ${tVoucherEntries.amount} else 0 end), 0)`,
      openingCredit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' and ${tVouchers.voucherId} is not null and ${tVouchers.voucherDate} < ${fromDate} then ${tVoucherEntries.amount} else 0 end), 0)`,
      periodDebit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' and ${tVouchers.voucherId} is not null and ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} then ${tVoucherEntries.amount} else 0 end), 0)`,
      periodCredit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' and ${tVouchers.voucherId} is not null and ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} then ${tVoucherEntries.amount} else 0 end), 0)`,
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
        isNull(tVouchers.deletedOn)
      )
    )
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId)
    .orderBy(mLedgers.ledgerName);

  // 4. Check export permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "trial_balance");
  const canExport = p?.e ?? false;

  return (
    <TrialBalanceClient
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
        openingDebit: Number(l.openingDebit),
        openingCredit: Number(l.openingCredit),
        periodDebit: Number(l.periodDebit),
        periodCredit: Number(l.periodCredit),
      }))}
      canExport={canExport}
    />
  );
}

