import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVoucherEntries,
  tVouchers,
  mUsers,
} from "@/lib/db/schema";
import { and, eq, isNull, sql, gte, lte, inArray, or, notInArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GroupOutstandingsClient from "./GroupOutstandingsClient";

export default async function GroupOutstandingsPage({
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

  // 2. Fetch all active ledger groups
  const groupsList = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // 3. Determine selected group
  let selectedGroupId = params.groupId ? Number(params.groupId) : null;
  if (!selectedGroupId && groupsList.length > 0) {
    // Try to find "Sundry Creditors" or "Sundry Debtors" as the default
    const sundryCreditors = groupsList.find((g) =>
      g.groupName.toLowerCase().includes("creditors")
    );
    const sundryDebtors = groupsList.find((g) =>
      g.groupName.toLowerCase().includes("debtors")
    );

    if (sundryCreditors) {
      selectedGroupId = sundryCreditors.groupId;
    } else if (sundryDebtors) {
      selectedGroupId = sundryDebtors.groupId;
    } else {
      const sorted = [...groupsList].sort((a, b) => a.groupName.localeCompare(b.groupName));
      selectedGroupId = sorted[0].groupId;
    }
  }

  const selectedGroup = selectedGroupId ? groupsList.find((g) => g.groupId === selectedGroupId) : null;

  // 4. Find descendant group IDs recursively
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

  let ledgersWithBalances: any[] = [];
  let groupVouchers: any[] = [];
  if (selectedGroup) {
    const descendantGroupIds = getDescendantGroupIds(selectedGroup.groupId);

    // 5. Fetch Ledgers under these groups with net balances in the selected period
    if (descendantGroupIds.length > 0) {
      ledgersWithBalances = await db
        .select({
          ledgerId: mLedgers.ledgerId,
          ledgerName: mLedgers.ledgerName,
          ledgerType: mLedgers.ledgerType,
          groupId: mLedgers.groupId,
          referenceId: mLedgers.referenceId,
          creditDays: mLedgers.creditDays,
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
        .where(
          and(
            eq(mLedgers.companyId, companyId),
            isNull(mLedgers.deletedOn),
            inArray(mLedgers.groupId, descendantGroupIds)
          )
        )
        .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId, mLedgers.referenceId, mLedgers.creditDays)
        .orderBy(mLedgers.ledgerName);

      const groupLedgerIds = ledgersWithBalances.map((l) => l.ledgerId);
      const groupRefIds = ledgersWithBalances
        .map((l) => l.referenceId ? Number(l.referenceId) : null)
        .filter((id): id is number => id !== null);

      const partyIdsToFetch = [...groupLedgerIds, ...groupRefIds];

      if (partyIdsToFetch.length > 0) {
        groupVouchers = await db
          .select({
            voucherId: tVouchers.voucherId,
            voucherNo: tVouchers.voucherNo,
            voucherType: tVouchers.voucherType,
            voucherDate: tVouchers.voucherDate,
            partyId: tVouchers.partyId,
            netAmount: tVouchers.netAmount,
            billDetails: tVouchers.billDetails,
            parentVoucherId: tVouchers.parentVoucherId,
            createdBy: tVouchers.createdBy,
            createdByName: mUsers.name,
            remarks: tVouchers.remarks,
          })
          .from(tVouchers)
          .leftJoin(mUsers, eq(tVouchers.createdBy, mUsers.id))
          .where(
            and(
              eq(tVouchers.companyId, companyId),
              inArray(tVouchers.partyId, partyIdsToFetch),
              isNull(tVouchers.deletedOn),
              notInArray(tVouchers.voucherType, ["purchase_order", "sales_order"]),
              gte(tVouchers.voucherDate, fromDate),
              lte(tVouchers.voucherDate, toDate)
            )
          )
          .orderBy(tVouchers.voucherDate, tVouchers.voucherId);
      }
    }
  }

  // 6. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "group_outstandings");
  const canExport = p?.e ?? false;

  return (
    <GroupOutstandingsClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      groups={groupsList}
      selectedGroup={selectedGroup || null}
      ledgers={ledgersWithBalances.map((l) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        ledgerType: l.ledgerType,
        groupId: l.groupId,
        referenceId: l.referenceId ? Number(l.referenceId) : null,
        creditDays: l.creditDays,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))}
      vouchers={groupVouchers}
      canExport={canExport}
    />
  );
}
