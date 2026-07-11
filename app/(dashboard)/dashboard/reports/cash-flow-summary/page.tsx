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
import { and, eq, isNull, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import CashFlowSummaryClient from "./CashFlowSummaryClient";

export default async function CashFlowSummaryPage({
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

  // 3. Fetch all Ledgers
  const ledgersList = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
    })
    .from(mLedgers)
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)));

  // 4. Find Cash/Bank descendant group IDs and Ledger classification
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

  // Helper to check if a ledger is cash or bank
  const isCashOrBank = (ledgerId: number): boolean => {
    const ledger = ledgersList.find((l) => l.ledgerId === ledgerId);
    if (!ledger) return false;
    return (
      ledger.ledgerType === "cash" ||
      ledger.ledgerType === "bank" ||
      (ledger.groupId !== null && cashGroupIds.includes(Number(ledger.groupId))) ||
      (ledger.groupId !== null && bankGroupIds.includes(Number(ledger.groupId)))
    );
  };

  // 5. Fetch Vouchers in the period
  const vouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    );

  // Map to store accumulated inflows/outflows per ledger
  const ledgerInflows = new Map<number, number>();
  const ledgerOutflows = new Map<number, number>();

  if (vouchers.length > 0) {
    const voucherIds = vouchers.map((v) => v.voucherId);

    // Fetch all entries for these vouchers
    const entries = await db
      .select({
        voucherId: tVoucherEntries.voucherId,
        ledgerId: tVoucherEntries.ledgerId,
        entryType: tVoucherEntries.entryType,
        amount: tVoucherEntries.amount,
      })
      .from(tVoucherEntries)
      .where(inArray(tVoucherEntries.voucherId, voucherIds));

    // Group entries by voucherId
    const entriesByVoucher = new Map<number, typeof entries>();
    entries.forEach((e) => {
      if (!entriesByVoucher.has(e.voucherId)) {
        entriesByVoucher.set(e.voucherId, []);
      }
      entriesByVoucher.get(e.voucherId)!.push(e);
    });

    // Process cash flow for each voucher
    vouchers.forEach((v) => {
      const vEntries = entriesByVoucher.get(v.voucherId) || [];
      const cashBankLeg = vEntries.filter((e) => isCashOrBank(e.ledgerId));
      const otherLeg = vEntries.filter((e) => !isCashOrBank(e.ledgerId));

      if (cashBankLeg.length === 0 || otherLeg.length === 0) return;

      // Net change in cash/bank (debit increases, credit decreases)
      const netCashBankChange = cashBankLeg.reduce((sum, e) => {
        const amt = Number(e.amount);
        return e.entryType === "debit" ? sum + amt : sum - amt;
      }, 0);

      if (Math.abs(netCashBankChange) < 0.009) return;

      if (netCashBankChange > 0) {
        // Net Inflow: Source is the credits of other ledgers
        otherLeg.forEach((e) => {
          const amt = Number(e.amount);
          const val = e.entryType === "credit" ? amt : -amt;
          ledgerInflows.set(e.ledgerId, (ledgerInflows.get(e.ledgerId) || 0) + val);
        });
      } else {
        // Net Outflow: Destination is the debits of other ledgers
        otherLeg.forEach((e) => {
          const amt = Number(e.amount);
          const val = e.entryType === "debit" ? amt : -amt;
          ledgerOutflows.set(e.ledgerId, (ledgerOutflows.get(e.ledgerId) || 0) + val);
        });
      }
    });
  }

  // Helper to determine the top-level ledger group (recursing up to root group)
  const getTopLevelGroup = (groupId: number | null): { groupId: number; groupName: string } | null => {
    if (!groupId) return null;
    let currentGroupId = groupId;
    let currentGroup = groups.find((g) => g.groupId === currentGroupId);
    if (!currentGroup) return null;

    let depth = 0;
    while (currentGroup && currentGroup.parentGroupId && depth < 10) {
      const parent = groups.find((g) => g.groupId === currentGroup?.parentGroupId);
      if (!parent) break;
      currentGroup = parent;
      depth++;
    }
    return { groupId: currentGroup.groupId, groupName: currentGroup.groupName };
  };

  // Rollup cash flows to groups and structure them
  interface CashFlowItem {
    ledgerId: number;
    ledgerName: string;
    amount: number;
  }

  interface CashFlowGroup {
    groupId: number;
    groupName: string;
    amount: number;
    items: CashFlowItem[];
  }

  const rollUpToGroups = (flows: Map<number, number>): CashFlowGroup[] => {
    const groupMap = new Map<number, CashFlowGroup>();

    flows.forEach((amount, ledgerId) => {
      if (Math.abs(amount) < 0.009) return; // filter out tiny balances

      const ledger = ledgersList.find((l) => l.ledgerId === ledgerId);
      if (!ledger) return;

      const topGroup = getTopLevelGroup(ledger.groupId ? Number(ledger.groupId) : null);
      const groupId = topGroup ? topGroup.groupId : 0;
      const groupName = topGroup ? topGroup.groupName : "Other Accounts";

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          groupId,
          groupName,
          amount: 0,
          items: [],
        });
      }

      const gFlow = groupMap.get(groupId)!;
      gFlow.amount += amount;
      gFlow.items.push({
        ledgerId,
        ledgerName: ledger.ledgerName,
        amount,
      });
    });

    // Sort items within each group, and sort groups by name
    return Array.from(groupMap.values())
      .map((g) => {
        g.items.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
        return g;
      })
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  };

  const inflowGroups = rollUpToGroups(ledgerInflows);
  const outflowGroups = rollUpToGroups(ledgerOutflows);

  // Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "cash_flow_summary");
  const canExport = p?.e ?? false;

  return (
    <CashFlowSummaryClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      inflowGroups={inflowGroups}
      outflowGroups={outflowGroups}
      canExport={canExport}
    />
  );
}
