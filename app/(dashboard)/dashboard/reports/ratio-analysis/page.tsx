import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  mLedgerGroups,
  tVoucherEntries,
  mInventory,
  tStockMovements,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, sql, gte, lte, or, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import RatioAnalysisClient from "./RatioAnalysisClient";

export default async function RatioAnalysisPage({
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

  if (!company) redirect("/setup-company");

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

  // 3. Fetch all ledger balances
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
    .leftJoin(tVoucherEntries, eq(mLedgers.ledgerId, tVoucherEntries.ledgerId))
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
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId);

  // 4. Fetch Opening Stock (movements before fromDate)
  const openingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when (${tStockMovements.movementType} in ('purchase','opening') or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} >= 0)) and ${tVouchers.voucherDate} < ${fromDate} then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when (${tStockMovements.movementType} = 'sale' or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} < 0)) and ${tVouchers.voucherDate} < ${fromDate} then abs(${tStockMovements.quantity}) else 0 end), 0)`,
      totalInwardVal: sql<number>`coalesce(sum(case when (${tStockMovements.movementType} in ('purchase','opening') or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} >= 0)) and ${tVouchers.voucherDate} < ${fromDate} then (case when ${tStockMovements.amount} > 0 then ${tStockMovements.amount} else abs(${tStockMovements.quantity}) * (case when ${tStockMovements.rate} > 0 then ${tStockMovements.rate} else ${mInventory.openingStockRate} end) end) else 0 end), 0)`,
    })
    .from(mInventory)
    .leftJoin(
      tStockMovements,
      and(eq(mInventory.inventoryId, tStockMovements.inventoryId), isNull(tStockMovements.deletedOn))
    )
    .leftJoin(tVouchers, and(eq(tStockMovements.voucherId, tVouchers.voucherId), isNull(tVouchers.deletedOn)))
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let openingStock = 0;
  for (const item of openingStockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    const totalInwardQty = Number(item.openingQty) + Number(item.qtyIn);
    const totalInwardVal = (Number(item.openingQty) * Number(item.openingRate)) + Number(item.totalInwardVal);
    const rate = totalInwardQty > 0 ? totalInwardVal / totalInwardQty : Number(item.openingRate);
    openingStock += Math.max(0, qty) * rate;
  }

  // 5. Fetch Closing Stock (movements up to toDate)
  const closingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} >= 0) then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} < 0) then abs(${tStockMovements.quantity}) else 0 end), 0)`,
      totalInwardVal: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') or (${tStockMovements.movementType} = 'adjustment' and ${tStockMovements.quantity} >= 0) then (case when ${tStockMovements.amount} > 0 then ${tStockMovements.amount} else abs(${tStockMovements.quantity}) * (case when ${tStockMovements.rate} > 0 then ${tStockMovements.rate} else ${mInventory.openingStockRate} end) end) else 0 end), 0)`,
    })
    .from(mInventory)
    .leftJoin(
      tStockMovements,
      and(eq(mInventory.inventoryId, tStockMovements.inventoryId), isNull(tStockMovements.deletedOn))
    )
    .leftJoin(tVouchers, and(eq(tStockMovements.voucherId, tVouchers.voucherId), isNull(tVouchers.deletedOn)))
    .where(
      and(
        eq(mInventory.companyId, companyId),
        isNull(mInventory.deletedOn),
        or(
          isNull(tStockMovements.voucherId),
          lte(tVouchers.voucherDate, toDate)
        )
      )
    )
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let closingStock = 0;
  for (const item of closingStockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    const totalInwardQty = Number(item.openingQty) + Number(item.qtyIn);
    const totalInwardVal = (Number(item.openingQty) * Number(item.openingRate)) + Number(item.totalInwardVal);
    const rate = totalInwardQty > 0 ? totalInwardVal / totalInwardQty : Number(item.openingRate);
    closingStock += Math.max(0, qty) * rate;
  }

  // Helper: top group resolver
  const getTopCategory = (groupId: number | null, ledgerType: string): string => {
    if (ledgerType === "capital") return "Capital Account";
    if (ledgerType === "loan") return "Loans (Liability)";
    if (ledgerType === "tax") return "Current Liabilities";
    if (ledgerType === "cash" || ledgerType === "bank") return "Current Assets";

    let currentGroupId = groupId;
    let depth = 0;
    while (currentGroupId && depth < 5) {
      const gp = groups.find((g) => g.groupId === currentGroupId);
      if (!gp) break;
      const name = gp.groupName.toLowerCase();
      if (name.includes("capital")) return "Capital Account";
      if (name.includes("loan") && (name.includes("secured") || name.includes("unsecured") || name.includes("liability"))) {
        return "Loans (Liability)";
      }
      if (name.includes("loan") && name.includes("asset")) {
        return "Current Assets";
      }
      if (name.includes("creditor") || name.includes("tax") || name.includes("provision") || name.includes("liability")) {
        return "Current Liabilities";
      }
      if (name.includes("debtor") || name.includes("cash") || name.includes("bank") || name.includes("stock") || name.includes("asset")) {
        return "Current Assets";
      }
      currentGroupId = gp.parentGroupId ?? null;
      depth++;
    }

    if (ledgerType === "company") return "Current Liabilities";
    if (ledgerType === "customer") return "Current Assets";
    return "Current Assets";
  };

  // Walk up to find if group matches specific name
  const isSubGroup = (groupId: number | null, nameSub: string): boolean => {
    let currentGroupId = groupId;
    let depth = 0;
    while (currentGroupId && depth < 5) {
      const gp = groups.find((g) => g.groupId === currentGroupId);
      if (!gp) break;
      if (gp.groupName.toLowerCase().includes(nameSub)) return true;
      currentGroupId = gp.parentGroupId ?? null;
      depth++;
    }
    return false;
  };

  // Roll up P&L items for Net Profit calculation
  const topGroup = (groupId: number | null): string => {
    if (!groupId) return "";
    let cur = groupId;
    for (let i = 0; i < 10; i++) {
      const g = groups.find((x) => x.groupId === cur);
      if (!g) return "";
      if (!g.parentGroupId) return g.groupName.toLowerCase();
      cur = g.parentGroupId;
    }
    return "";
  };

  // Group balances
  let capitalTotal = 0;
  let loansTotal = 0;
  let currentLiabilitiesTotal = 0;
  let currentAssetsTotal = 0;

  // Sub-group balances
  let cashTotal = 0;
  let bankTotal = 0;
  let bankODTotal = 0;
  let debtorsTotal = 0;
  let creditorsTotal = 0;

  // Direct registers
  let salesTotal = 0;
  let purchaseTotal = 0;
  let directExpTotal = 0;
  let directIncTotal = 0;
  let indirectExpTotal = 0;
  let indirectIncTotal = 0;

  ledgers.forEach((l) => {
    const netDebit = Number(l.debit) - Number(l.credit);
    const grp = topGroup(l.groupId);

    const isSales = l.ledgerType === "sales" || grp.includes("sales");
    const isIncome = l.ledgerType === "income" || grp.includes("income");
    const isPurchase = l.ledgerType === "purchase" || grp.includes("purchase");
    const isExpense = l.ledgerType === "expense" || grp.includes("expense");
    const isPL = isSales || isIncome || isPurchase || isExpense;

    // Classify for Profit & Loss
    if (isSales) {
      salesTotal += (Number(l.credit) - Number(l.debit));
    } else if (isIncome) {
      const isDirect = grp.includes("direct") || grp.includes("trading") || grp.includes("revenue");
      if (isDirect) directIncTotal += (Number(l.credit) - Number(l.debit));
      else indirectIncTotal += (Number(l.credit) - Number(l.debit));
    } else if (isPurchase) {
      purchaseTotal += netDebit;
    } else if (isExpense) {
      const isDirect = grp.includes("direct") || grp.includes("trading") || grp.includes("manufacturing");
      if (isDirect) directExpTotal += netDebit;
      else indirectExpTotal += netDebit;
    }

    if (!isPL) {
      // Classify for Balance Sheet
      const topCat = getTopCategory(l.groupId, l.ledgerType);
      if (topCat === "Capital Account") {
        capitalTotal += (Number(l.credit) - Number(l.debit));
      } else if (topCat === "Loans (Liability)") {
        loansTotal += (Number(l.credit) - Number(l.debit));
      } else if (topCat === "Current Liabilities") {
        const isCreditor = isSubGroup(l.groupId, "creditor");
        if (isCreditor) {
          creditorsTotal += (Number(l.credit) - Number(l.debit));
        }
        currentLiabilitiesTotal += (Number(l.credit) - Number(l.debit));
      } else if (topCat === "Current Assets") {
        const isDebtor = isSubGroup(l.groupId, "debtor");
        const isCash = l.ledgerType === "cash" || isSubGroup(l.groupId, "cash");
        const isOD = isSubGroup(l.groupId, "od") || isSubGroup(l.groupId, "overdraft");
        const isBank = l.ledgerType === "bank" || isSubGroup(l.groupId, "bank");
        const isStock = isSubGroup(l.groupId, "stock");

        if (isDebtor) {
          debtorsTotal += netDebit;
        } else if (isCash) {
          cashTotal += netDebit;
        } else if (isOD) {
          bankODTotal += (Number(l.credit) - Number(l.debit)); // Credit positive for OD Accounts
        } else if (isBank) {
          bankTotal += netDebit;
        }
        if (!isStock) {
          currentAssetsTotal += netDebit;
        }
      }
    }
  });

  // Calculate Profit metrics
  const drSide1 = openingStock + purchaseTotal + directExpTotal;
  const crSide1 = salesTotal + closingStock + directIncTotal;
  const grossProfit = crSide1 - drSide1;

  const grossLossBF = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const grossProfitBF = grossProfit > 0 ? grossProfit : 0;
  const drSide2 = grossLossBF + indirectExpTotal;
  const crSide2 = grossProfitBF + indirectIncTotal;
  const netProfit = crSide2 - drSide2;

  // Add Closing Stock to Current Assets
  currentAssetsTotal += closingStock;

  // Permissions Check
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ratio_analysis");
  const canExport = p?.e ?? false;

  return (
    <RatioAnalysisClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      data={{
        capitalAccount: capitalTotal,
        loansLiability: loansTotal,
        currentLiabilities: currentLiabilitiesTotal,
        currentAssets: currentAssetsTotal,
        cashInHand: cashTotal,
        bankAccounts: bankTotal,
        bankOD: bankODTotal,
        sundryDebtors: debtorsTotal,
        sundryCreditors: creditorsTotal,
        salesAccounts: salesTotal,
        purchaseAccounts: purchaseTotal,
        closingStock: closingStock,
        netProfit: netProfit,
        grossProfit: grossProfit,
        indirectExpenses: indirectExpTotal,
        directExpenses: directExpTotal,
        openingStock: openingStock,
      }}
      canExport={canExport}
    />
  );
}
