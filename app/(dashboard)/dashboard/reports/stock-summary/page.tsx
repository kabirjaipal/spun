import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mInventory,
  mInventoryGroups,
  mInventoryCategories,
  tStockMovements,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, sql, or } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import StockSummaryClient from "./StockSummaryClient";

export default async function StockSummaryPage({
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

  // 2. Fetch inventory groups
  const groups = await db
    .select({
      groupId: mInventoryGroups.inventoryGroupId,
      groupName: mInventoryGroups.groupName,
    })
    .from(mInventoryGroups)
    .where(and(eq(mInventoryGroups.companyId, companyId), isNull(mInventoryGroups.deletedOn)));

  // 3. Fetch inventory categories
  const categories = await db
    .select({
      categoryId: mInventoryCategories.inventoryCategoryId,
      categoryName: mInventoryCategories.categoryName,
    })
    .from(mInventoryCategories)
    .where(and(eq(mInventoryCategories.companyId, companyId), isNull(mInventoryCategories.deletedOn)));

  // 4. Fetch all inventory items for company
  const items = await db
    .select({
      inventoryId: mInventory.inventoryId,
      inventoryCode: mInventory.inventoryCode,
      inventoryName: mInventory.inventoryName,
      unit: mInventory.unit,
      openingStockQty: mInventory.openingStockQty,
      openingStockRate: mInventory.openingStockRate,
      inventoryGroupId: mInventory.inventoryGroupId,
      inventoryCategoryId: mInventory.inventoryCategoryId,
    })
    .from(mInventory)
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)));

  // 5. Fetch all stock movements for the company with voucher info
  const movements = await db
    .select({
      stockMovementId: tStockMovements.stockMovementId,
      inventoryId: tStockMovements.inventoryId,
      voucherId: tStockMovements.voucherId,
      movementType: tStockMovements.movementType,
      quantity: tStockMovements.quantity,
      rate: tStockMovements.rate,
      amount: tStockMovements.amount,
      createdOn: tStockMovements.createdOn,
      voucherDate: tVouchers.voucherDate,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
    })
    .from(tStockMovements)
    .leftJoin(tVouchers, eq(tStockMovements.voucherId, tVouchers.voucherId))
    .where(
      and(
        eq(tStockMovements.companyId, companyId),
        isNull(tStockMovements.deletedOn),
        or(
          isNull(tStockMovements.voucherId),
          and(
            isNull(tVouchers.deletedOn)
          )
        )
      )
    )
    .orderBy(sql`coalesce(${tVouchers.voucherDate}, cast(${tStockMovements.createdOn} as date))`);

  // 6. Permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "stock_summary");
  const canExport = p?.e ?? false;

  return (
    <StockSummaryClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      groups={groups}
      categories={categories}
      items={items.map((i) => ({
        inventoryId: i.inventoryId,
        inventoryCode: i.inventoryCode,
        inventoryName: i.inventoryName,
        unit: i.unit,
        openingStockQty: Number(i.openingStockQty),
        openingStockRate: Number(i.openingStockRate),
        inventoryGroupId: i.inventoryGroupId ? Number(i.inventoryGroupId) : null,
        inventoryCategoryId: i.inventoryCategoryId ? Number(i.inventoryCategoryId) : null,
      }))}
      movements={movements.map((m) => ({
        stockMovementId: m.stockMovementId,
        inventoryId: Number(m.inventoryId),
        voucherId: m.voucherId ? Number(m.voucherId) : null,
        movementType: m.movementType,
        quantity: Number(m.quantity),
        rate: Number(m.rate),
        amount: Number(m.amount),
        voucherDate: m.voucherDate || m.createdOn.toISOString().split("T")[0],
        voucherNo: m.voucherNo || null,
        voucherType: m.voucherType || null,
      }))}
      canExport={canExport}
    />
  );
}
