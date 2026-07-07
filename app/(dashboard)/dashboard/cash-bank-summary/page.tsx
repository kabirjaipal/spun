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
import { and, eq, isNull, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import CashBankSummaryClient from "./CashBankSummaryClient";

export default async function CashBankSummaryPage({
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

  // 3. Fetch Ledgers with aggregated opening balances (before fromDate) and period transactions (within range)
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
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId)
    .orderBy(mLedgers.ledgerName);

  // 4. Find group hierarchy descendant IDs for Cash in Hand and Bank Account
  const cashGroupNames = ["cash in hand", "cash-in-hand"];
  const bankGroupNames = ["bank account", "bank accounts", "bank a/c", "bank a/cs"];

  const getDescendantGroupIds = (parentIds: number[]): number[] => {
    const result = [...parentIds];
    let current = [...parentIds];
    while (current.length > 0) {
      const children = groups
        .filter((g) => g.parentGroupId && current.includes(g.parentGroupId))
        .map((g) => g.groupId);
      if (children.length === 0) break;
      result.push(...children);
      current = children;
    }
    return result;
  };

  const cashParentIds = groups
    .filter((g) => cashGroupNames.includes(g.groupName.toLowerCase()))
    .map((g) => g.groupId);
  const cashGroupIds = getDescendantGroupIds(cashParentIds);

  const bankParentIds = groups
    .filter((g) => bankGroupNames.includes(g.groupName.toLowerCase()))
    .map((g) => g.groupId);
  const bankGroupIds = getDescendantGroupIds(bankParentIds);

  // 5. Structure and map the ledgers
  const ledgers = rawLedgers.map((l) => {
    const openingBalance = Number(l.openDebit) - Number(l.openCredit);
    const debitPeriod = Number(l.periodDebit);
    const creditPeriod = Number(l.periodCredit);
    const closingBalance = openingBalance + debitPeriod - creditPeriod;

    // Check classification
    const isCash =
      l.ledgerType === "cash" ||
      (l.groupId !== null && cashGroupIds.includes(Number(l.groupId)));

    const isBank =
      l.ledgerType === "bank" ||
      (l.groupId !== null && bankGroupIds.includes(Number(l.groupId)));

    return {
      ledgerId: l.ledgerId,
      ledgerName: l.ledgerName,
      ledgerType: l.ledgerType,
      groupId: l.groupId ? Number(l.groupId) : null,
      openingBalance,
      debitPeriod,
      creditPeriod,
      closingBalance,
      isCash,
      isBank,
    };
  });

  // 6. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "cash_bank_summary");
  const canExport = p?.e ?? false;

  return (
    <CashBankSummaryClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      ledgers={ledgers}
      canExport={canExport}
    />
  );
}
