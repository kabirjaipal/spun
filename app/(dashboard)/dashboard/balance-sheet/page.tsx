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
} from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import BalanceSheetClient from "./BalanceSheetClient";

export default async function BalanceSheetPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

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

  // 2. Fetch Ledger Groups
  const groups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  // 3. Fetch Ledgers with balances
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
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.groupId)
    .orderBy(mLedgers.ledgerName);

  // 4. Calculate Closing Stock dynamically from inventory + movements
  const stockData = await db
    .select({
      inventoryId: mInventory.inventoryId,
      openingQty: mInventory.openingStockQty,
      openingRate: mInventory.openingStockRate,
      qtyIn: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.quantity} else 0 end), 0)`,
      qtyOut: sql<number>`coalesce(sum(case when ${tStockMovements.movementType} = 'sale' then ${tStockMovements.quantity} else 0 end), 0)`,
      avgRateIn: sql<number>`coalesce(avg(case when ${tStockMovements.movementType} in ('purchase','opening') then ${tStockMovements.rate} else null end), 0)`,
    })
    .from(mInventory)
    .leftJoin(tStockMovements, eq(mInventory.inventoryId, tStockMovements.inventoryId))
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
    .groupBy(mInventory.inventoryId, mInventory.openingStockQty, mInventory.openingStockRate);

  let calculatedClosingStock = 0;
  for (const item of stockData) {
    const qty = Number(item.openingQty) + Number(item.qtyIn) - Number(item.qtyOut);
    // Use average inbound rate if available; fallback to opening stock rate
    const rate = Number(item.avgRateIn) > 0 ? Number(item.avgRateIn) : Number(item.openingRate);
    calculatedClosingStock += Math.max(0, qty) * rate;
  }

  // 5. Check role-based export permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "balance_sheet");
  const canExport = p?.e ?? false;

  return (
    <BalanceSheetClient
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
      calculatedClosingStock={calculatedClosingStock}
      canExport={canExport}
    />
  );
}
