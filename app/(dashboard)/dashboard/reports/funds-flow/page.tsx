import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVouchers,
  tVoucherEntries,
  tStockMovements,
  mInventory,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, or, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import FundsFlowClient from "./FundsFlowClient";

export default async function FundsFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string }>;
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

  // 2. Fetch Ledger Groups & Ledgers
  const groups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  const ledgersList = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
    })
    .from(mLedgers)
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)));

  // 3. Find descendant groups for Current Assets and Current Liabilities
  const assetGroupNames = [
    "current assets",
    "sundry debtors",
    "cash in hand",
    "bank account",
    "bank accounts",
    "stock in hand",
    "loan (assets)",
    "deposits & advance assets",
  ];
  const liabilityGroupNames = [
    "current liabilities",
    "sundry creditors",
    "duties & taxes",
    "provisions",
  ];

  const getDescendantGroupIds = (parentNames: string[]): number[] => {
    const parentIds = groups
      .filter((g) => parentNames.includes(g.groupName.toLowerCase()))
      .map((g) => g.groupId);

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

  const currentAssetGroupIds = getDescendantGroupIds(assetGroupNames);
  const currentLiabilityGroupIds = getDescendantGroupIds(liabilityGroupNames);

  const isCurrentAsset = (l: typeof ledgersList[0]): boolean => {
    return (
      l.ledgerType === "cash" ||
      l.ledgerType === "bank" ||
      (l.groupId !== null && currentAssetGroupIds.includes(Number(l.groupId)))
    );
  };

  const isCurrentLiability = (l: typeof ledgersList[0]): boolean => {
    return (
      l.ledgerType === "tax" ||
      (l.groupId !== null && currentLiabilityGroupIds.includes(Number(l.groupId)))
    );
  };

  const currentAssetLedgerIds = ledgersList.filter(isCurrentAsset).map((l) => l.ledgerId);
  const currentLiabilityLedgerIds = ledgersList.filter(isCurrentLiability).map((l) => l.ledgerId);
  const allWorkingCapitalLedgerIds = [...currentAssetLedgerIds, ...currentLiabilityLedgerIds];

  // 4. Fetch Voucher Entries up to toDate for all relevant ledgers
  let entries: any[] = [];
  if (allWorkingCapitalLedgerIds.length > 0) {
    entries = await db
      .select({
        ledgerId: tVoucherEntries.ledgerId,
        entryType: tVoucherEntries.entryType,
        amount: tVoucherEntries.amount,
        voucherDate: tVouchers.voucherDate,
      })
      .from(tVoucherEntries)
      .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          isNull(tVouchers.deletedOn),
          lte(tVouchers.voucherDate, toDate),
          inArray(tVoucherEntries.ledgerId, allWorkingCapitalLedgerIds)
        )
      );
  }

  // 5. Fetch Stock Movements up to toDate
  const stockMovements = await db
    .select({
      inventoryId: tStockMovements.inventoryId,
      quantity: tStockMovements.quantity,
      rate: tStockMovements.rate,
      movementType: tStockMovements.movementType,
      voucherDate: tVouchers.voucherDate,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
    })
    .from(tStockMovements)
    .leftJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .leftJoin(mInventory, eq(tStockMovements.inventoryId, mInventory.inventoryId))
    .where(
      and(
        eq(tStockMovements.companyId, companyId),
        isNull(tStockMovements.deletedOn),
        or(
          isNull(tStockMovements.voucherId),
          and(
            isNull(tVouchers.deletedOn),
            lte(tVouchers.voucherDate, toDate)
          )
        )
      )
    );

  // Helper to compute Closing Stock dynamic value at any date D
  const getClosingStockAtDate = (dateLimit: string): number => {
    // Group movements by inventoryId
    const itemMovements = new Map<number, typeof stockMovements>();
    stockMovements.forEach((m) => {
      // Keep static opening movements or movements up to dateLimit
      const isValid = !m.voucherDate || m.voucherDate <= dateLimit;
      if (isValid) {
        if (!itemMovements.has(m.inventoryId)) {
          itemMovements.set(m.inventoryId, []);
        }
        itemMovements.get(m.inventoryId)!.push(m);
      }
    });

    let stockValue = 0;
    itemMovements.forEach((movs) => {
      const first = movs[0];
      const openingQty = Number(first.openingQty);
      const openingRate = Number(first.openingRate);

      let qtyIn = 0;
      let qtyOut = 0;
      let rateInSum = 0;
      let rateInCount = 0;

      movs.forEach((m) => {
        const qty = Number(m.quantity);
        const rate = Number(m.rate);
        if (m.movementType === "purchase" || m.movementType === "opening") {
          qtyIn += qty;
          if (rate > 0) {
            rateInSum += rate;
            rateInCount++;
          }
        } else if (m.movementType === "sale") {
          qtyOut += qty;
        }
      });

      const qty = openingQty + qtyIn - qtyOut;
      const avgRateIn = rateInCount > 0 ? rateInSum / rateInCount : openingRate;
      stockValue += Math.max(0, qty) * avgRateIn;
    });

    return stockValue;
  };

  // Helper to compute Working Capital balance at date D
  const getWorkingCapitalAtDate = (dateLimit: string): number => {
    let assetsSum = 0;
    let liabilitiesSum = 0;

    // Filter relevant entries up to dateLimit
    const filteredEntries = entries.filter((e) => e.voucherDate <= dateLimit);

    // Asset balances
    currentAssetLedgerIds.forEach((ledgerId) => {
      const lEntries = filteredEntries.filter((e) => e.ledgerId === ledgerId);
      const balance = lEntries.reduce((sum, e) => {
        const amt = Number(e.amount);
        return e.entryType === "debit" ? sum + amt : sum - amt;
      }, 0);
      assetsSum += balance;
    });

    // Add closing stock dynamic value
    assetsSum += getClosingStockAtDate(dateLimit);

    // Liability balances
    currentLiabilityLedgerIds.forEach((ledgerId) => {
      const lEntries = filteredEntries.filter((e) => e.ledgerId === ledgerId);
      const balance = lEntries.reduce((sum, e) => {
        const amt = Number(e.amount);
        return e.entryType === "credit" ? sum + amt : sum - amt;
      }, 0);
      liabilitiesSum += balance;
    });

    return assetsSum - liabilitiesSum;
  };

  // 6. Generate chronological list of months in date range
  const start = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");

  const monthsList: { key: string; label: string; year: number; monthIndex: number }[] = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (curr <= endLimit) {
    const label = curr.toLocaleDateString("en-US", { month: "long" });
    const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
    monthsList.push({
      key,
      label,
      year: curr.getFullYear(),
      monthIndex: curr.getMonth(),
    });
    curr.setMonth(curr.getMonth() + 1);
  }

  // 7. Calculate monthly summaries
  const monthlySummary = monthsList.map((m, idx) => {
    // Start of month
    const startStr = `${m.year}-${String(m.monthIndex + 1).padStart(2, "0")}-01`;
    // End of month
    const lastDay = new Date(m.year, m.monthIndex + 1, 0).getDate();
    const endStr = `${m.year}-${String(m.monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Opening Working Capital: balance before the 1st day of the month
    const prevDay = new Date(m.year, m.monthIndex, 0);
    const prevDayStr = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, "0")}-${String(prevDay.getDate()).padStart(2, "0")}`;
    const openingWorkingCapital = getWorkingCapitalAtDate(prevDayStr);

    // Closing Working Capital: balance at the end of the month
    const closingWorkingCapital = getWorkingCapitalAtDate(endStr);

    // Funds Flow: Closing Working Capital - Opening Working Capital
    const fundsFlow = closingWorkingCapital - openingWorkingCapital;

    return {
      monthKey: m.key,
      monthName: m.label,
      year: m.year,
      openingWorkingCapital,
      closingWorkingCapital,
      fundsFlow,
    };
  });

  // 8. Calculate detailed monthly breakdown if month parameter is provided
  const monthParam = params.month;
  let detailedMonth: {
    monthName: string;
    assets: any[];
    liabilities: any[];
    openingStock: number;
    closingStock: number;
  } | null = null;

  if (monthParam) {
    const [mYear, mMonthNum] = monthParam.split("-").map(Number);
    const monthIndex = mMonthNum - 1;
    const monthName = new Date(mYear, monthIndex, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    const lastDay = new Date(mYear, mMonthNum, 0).getDate();
    const endStr = `${mYear}-${String(mMonthNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const prevDay = new Date(mYear, monthIndex, 0);
    const prevDayStr = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, "0")}-${String(prevDay.getDate()).padStart(2, "0")}`;

    const openingStock = getClosingStockAtDate(prevDayStr);
    const closingStock = getClosingStockAtDate(endStr);

    const assetDetails: any[] = [];
    const liabilityDetails: any[] = [];

    ledgersList.filter(isCurrentAsset).forEach((l) => {
      const lEntries = entries.filter((e) => e.ledgerId === l.ledgerId);
      
      const opening = lEntries
        .filter((e) => e.voucherDate! <= prevDayStr)
        .reduce((sum, e) => e.entryType === "debit" ? sum + Number(e.amount) : sum - Number(e.amount), 0);

      const closing = lEntries
        .filter((e) => e.voucherDate! <= endStr)
        .reduce((sum, e) => e.entryType === "debit" ? sum + Number(e.amount) : sum - Number(e.amount), 0);

      const flow = closing - opening;

      if (Math.abs(opening) > 0.01 || Math.abs(closing) > 0.01) {
        assetDetails.push({
          ledgerId: l.ledgerId,
          ledgerName: l.ledgerName,
          openingBalance: opening,
          closingBalance: closing,
          flow,
        });
      }
    });

    ledgersList.filter(isCurrentLiability).forEach((l) => {
      const lEntries = entries.filter((e) => e.ledgerId === l.ledgerId);

      const opening = lEntries
        .filter((e) => e.voucherDate! <= prevDayStr)
        .reduce((sum, e) => e.entryType === "credit" ? sum + Number(e.amount) : sum - Number(e.amount), 0);

      const closing = lEntries
        .filter((e) => e.voucherDate! <= endStr)
        .reduce((sum, e) => e.entryType === "credit" ? sum + Number(e.amount) : sum - Number(e.amount), 0);

      const flow = closing - opening;

      if (Math.abs(opening) > 0.01 || Math.abs(closing) > 0.01) {
        liabilityDetails.push({
          ledgerId: l.ledgerId,
          ledgerName: l.ledgerName,
          openingBalance: opening,
          closingBalance: closing,
          flow,
        });
      }
    });

    detailedMonth = {
      monthName,
      assets: assetDetails,
      liabilities: liabilityDetails,
      openingStock,
      closingStock,
    };
  }

  // 9. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "funds_flow_summary");
  const canExport = p?.e ?? false;

  return (
    <FundsFlowClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      monthlySummary={monthlySummary}
      detailedMonth={detailedMonth}
      canExport={canExport}
    />
  );
}
