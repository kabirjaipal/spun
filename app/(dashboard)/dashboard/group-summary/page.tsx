import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVouchers,
  tVoucherEntries,
} from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GroupSummaryClient from "./GroupSummaryClient";

export default async function GroupSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; from?: string; to?: string }>;
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
  // 2. Fetch all groups
  const groupsList = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // If no group is selected, default to the first group alphabetically
  let selectedGroupId = params.groupId ? Number(params.groupId) : null;
  if (!selectedGroupId && groupsList.length > 0) {
    const sorted = [...groupsList].sort((a, b) => a.groupName.localeCompare(b.groupName));
    selectedGroupId = sorted[0].groupId;
  }

  const selectedGroup = selectedGroupId ? groupsList.find((g) => g.groupId === selectedGroupId) : null;
  if (!selectedGroup) {
    return (
      <GroupSummaryClient
        company={{
          companyId: company.companyId,
          companyName: company.companyName,
          gstNo: company.gstNo,
          address: company.address,
        }}
        groups={groupsList}
        selectedGroup={null}
        reportItems={[]}
        canExport={false}
      />
    );
  }

  // 3. Fetch all Ledgers with aggregated opening and period transactions in a single query
  const rawLedgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
      openDebit: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} < ${fromDate} and ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      openCredit: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} < ${fromDate} and ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      periodDebit: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      periodCredit: sql<number>`coalesce(sum(case when ${tVouchers.voucherDate} >= ${fromDate} and ${tVouchers.voucherDate} <= ${toDate} and ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
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
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId);

  // Helper to trace descendants recursively for any group ID
  const getDescendantGroupIds = (parentGroupId: number): number[] => {
    const result = [parentGroupId];
    let current = [parentGroupId];
    while (current.length > 0) {
      const children = groupsList
        .filter((g) => g.parentGroupId && current.includes(g.parentGroupId))
        .map((g) => g.groupId);
      if (children.length === 0) break;
      result.push(...children);
      current = children;
    }
    return result;
  };

  // Compile child ledger balances
  const ledgersWithBalances = rawLedgers.map((l) => {
    const openingBalance = Number(l.openDebit) - Number(l.openCredit);
    const debitPeriod = Number(l.periodDebit);
    const creditPeriod = Number(l.periodCredit);
    const closingBalance = openingBalance + debitPeriod - creditPeriod;

    return {
      ledgerId: l.ledgerId,
      ledgerName: l.ledgerName,
      ledgerType: l.ledgerType,
      groupId: l.groupId ? Number(l.groupId) : null,
      openingBalance,
      debitPeriod,
      creditPeriod,
      closingBalance,
    };
  });

  // Direct children of selected group
  const childGroups = groupsList.filter((g) => g.parentGroupId === selectedGroupId);
  const childLedgers = ledgersWithBalances.filter((l) => l.groupId === selectedGroupId);

  // Map subgroups to aggregated totals
  const subgroupItems = childGroups.map((g) => {
    const descGroupIds = getDescendantGroupIds(g.groupId);
    const subgroupLedgers = ledgersWithBalances.filter(
      (l) => l.groupId !== null && descGroupIds.includes(l.groupId)
    );

    const openingBalance = subgroupLedgers.reduce((sum, l) => sum + l.openingBalance, 0);
    const debitPeriod = subgroupLedgers.reduce((sum, l) => sum + l.debitPeriod, 0);
    const creditPeriod = subgroupLedgers.reduce((sum, l) => sum + l.creditPeriod, 0);
    const closingBalance = subgroupLedgers.reduce((sum, l) => sum + l.closingBalance, 0);

    return {
      id: `group-${g.groupId}`,
      groupId: g.groupId,
      name: g.groupName,
      type: "group" as const,
      openingBalance,
      debitPeriod,
      creditPeriod,
      closingBalance,
    };
  });

  // Map direct child ledgers
  const ledgerItems = childLedgers.map((l) => ({
    id: `ledger-${l.ledgerId}`,
    ledgerId: l.ledgerId,
    name: l.ledgerName,
    type: "ledger" as const,
    openingBalance: l.openingBalance,
    debitPeriod: l.debitPeriod,
    creditPeriod: l.creditPeriod,
    closingBalance: l.closingBalance,
  }));

  const reportItems = [...subgroupItems, ...ledgerItems].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // 4. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "group_summary");
  const canExport = p?.e ?? false;

  return (
    <GroupSummaryClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      groups={groupsList}
      selectedGroup={{
        groupId: selectedGroup.groupId,
        groupName: selectedGroup.groupName,
      }}
      reportItems={reportItems}
      canExport={canExport}
    />
  );
}
