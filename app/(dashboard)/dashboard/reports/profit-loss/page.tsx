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
import { and, eq, isNull, sql, gte, lte, or } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ProfitLossClient from "./ProfitLossClient";

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  // Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 1. Company info
  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);
  if (!company) redirect("/setup-company");

  // 2. Ledger Groups
  const groups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // 3. P&L ledger balances — only expense/income/sales/purchase types, date-filtered
  const ledgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      groupId: mLedgers.groupId,
      debit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' and ${tVouchers.voucherId} is not null then ${tVoucherEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' and ${tVouchers.voucherId} is not null then ${tVoucherEntries.amount} else 0 end), 0)`,
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
    .where(
      and(
        eq(mLedgers.companyId, companyId),
        isNull(mLedgers.deletedOn),
        // Only P&L account types
        sql`${mLedgers.ledgerType} in ('sales', 'purchase', 'expense', 'income')`
      )
    )
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId)
    .orderBy(mLedgers.ledgerName);

  // 4. Opening Stock = inventory opening stock values (at start of period)
  // Opening Stock = closing stock at start of FY = computed from movements BEFORE fromDate
  const openingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') and ${tVouchers.voucherDate} < ${fromDate} then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' and ${tVouchers.voucherDate} < ${fromDate} then ${tStockMovements.quantity} else 0 end), 0)`,
      avgRateIn: sql<number>`coalesce(avg(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.rate} else null end), 0)`,
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
    const rate = Number(item.avgRateIn) > 0 ? Number(item.avgRateIn) : Number(item.openingRate);
    openingStock += Math.max(0, qty) * rate;
  }

  // 5. Closing Stock = inventory value at end of period (toDate)
  const closingStockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' then ${tStockMovements.quantity} else 0 end), 0)`,
      avgRateIn: sql<number>`coalesce(avg(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.rate} else null end), 0)`,
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
          and(isNull(tVouchers.deletedOn), lte(tVouchers.voucherDate, toDate))
        )
      )
    )
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let closingStock = 0;
  for (const item of closingStockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    const rate = Number(item.avgRateIn) > 0 ? Number(item.avgRateIn) : Number(item.openingRate);
    closingStock += Math.max(0, qty) * rate;
  }

  // 6. Permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "profit_loss");
  const canExport = p?.e ?? false;

  return (
    <ProfitLossClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      groups={groups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        parentGroupId: g.parentGroupId,
      }))}
      ledgers={ledgers.map((l) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        ledgerType: l.ledgerType,
        groupId: l.groupId,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))}
      openingStock={openingStock}
      closingStock={closingStock}
      canExport={canExport}
    />
  );
}
