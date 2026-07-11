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
import { and, eq, isNull, sql, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GroupVouchersClient from "./GroupVouchersClient";

export default async function GroupVouchersPage({
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

  // Default selected group
  let selectedGroupId = params.groupId ? Number(params.groupId) : null;
  if (!selectedGroupId && groupsList.length > 0) {
    const sorted = [...groupsList].sort((a, b) => a.groupName.localeCompare(b.groupName));
    selectedGroupId = sorted[0].groupId;
  }

  const selectedGroup = selectedGroupId ? groupsList.find((g) => g.groupId === selectedGroupId) : null;
  if (!selectedGroup) {
    return (
      <GroupVouchersClient
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

  // 3. Find descendant groups
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

  const descendantGroupIds = getDescendantGroupIds(selectedGroup.groupId);

  // 4. Fetch all active ledgers in these groups
  const activeLedgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
    })
    .from(mLedgers)
    .where(
      and(
        eq(mLedgers.companyId, companyId),
        isNull(mLedgers.deletedOn),
        inArray(mLedgers.groupId, descendantGroupIds)
      )
    );

  const ledgerIds = activeLedgers.map((l) => l.ledgerId);

  // 5. Fetch all voucher entries belonging to these ledgers within period
  let reportItems: any[] = [];
  if (ledgerIds.length > 0) {
    reportItems = await db
      .select({
        entryId: tVoucherEntries.voucherEntryId,
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        voucherType: tVouchers.voucherType,
        amount: tVoucherEntries.amount,
        entryType: tVoucherEntries.entryType,
        ledgerId: tVoucherEntries.ledgerId,
        ledgerName: mLedgers.ledgerName,
      })
      .from(tVoucherEntries)
      .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
      .leftJoin(mLedgers, eq(tVoucherEntries.ledgerId, mLedgers.ledgerId))
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          isNull(tVouchers.deletedOn),
          gte(tVouchers.voucherDate, fromDate),
          lte(tVouchers.voucherDate, toDate),
          inArray(tVoucherEntries.ledgerId, ledgerIds)
        )
      )
      .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);
  }

  // 6. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "group_vouchers");
  const canExport = p?.e ?? false;

  return (
    <GroupVouchersClient
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
      reportItems={reportItems.map((item) => ({
        entryId: item.entryId,
        voucherId: item.voucherId,
        voucherNo: item.voucherNo,
        voucherDate: item.voucherDate,
        voucherType: item.voucherType,
        amount: Number(item.amount),
        entryType: item.entryType,
        ledgerId: item.ledgerId,
        ledgerName: item.ledgerName || "",
      }))}
      canExport={canExport}
    />
  );
}
