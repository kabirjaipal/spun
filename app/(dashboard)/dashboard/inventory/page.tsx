import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mTaxRates, mInventoryGroups, mInventoryCategories, mUnitsOfMeasurement } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [rows, taxRates, inventoryGroups, inventoryCategories, unitsList] = await Promise.all([
    db
      .select({
        inventoryId: mInventory.inventoryId,
        inventoryCode: mInventory.inventoryCode,
        inventoryName: mInventory.inventoryName,
        unit: mInventory.unit,
        gstRateId: mInventory.gstRateId,
        openingStockQty: mInventory.openingStockQty,
        openingStockRate: mInventory.openingStockRate,
        taxName: mTaxRates.taxName,
        taxPercent: mTaxRates.taxPercent,
        hsnCode: mInventory.hsnCode,
        inventoryGroupId: mInventory.inventoryGroupId,
        inventoryCategoryId: mInventory.inventoryCategoryId,
        gstType: mInventory.gstType,
        gstPercent: mInventory.gstPercent,
        isConsumable: mInventory.isConsumable,
        consumeWithInventoryId: mInventory.consumeWithInventoryId,
        consumptionRatio: mInventory.consumptionRatio,
        shortagePercent: mInventory.shortagePercent,
      })
      .from(mInventory)
      .leftJoin(mTaxRates, eq(mInventory.gstRateId, mTaxRates.taxRateId))
      .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
      .orderBy(mInventory.inventoryName),
    db.select().from(mTaxRates).where(isNull(mTaxRates.deletedOn)).orderBy(mTaxRates.taxPercent),
    db.select().from(mInventoryGroups).where(and(eq(mInventoryGroups.companyId, companyId), isNull(mInventoryGroups.deletedOn))).orderBy(mInventoryGroups.groupName),
    db.select().from(mInventoryCategories).where(and(eq(mInventoryCategories.companyId, companyId), isNull(mInventoryCategories.deletedOn))).orderBy(mInventoryCategories.categoryName),
    db.select().from(mUnitsOfMeasurement).where(and(eq(mUnitsOfMeasurement.companyId, companyId), isNull(mUnitsOfMeasurement.deletedOn))).orderBy(mUnitsOfMeasurement.unitCode),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "inventory");
  const pg = perms.find((x) => x.accessItem === "inventory_groups");
  const pc = perms.find((x) => x.accessItem === "inventory_categories");
  const pu = perms.find((x) => x.accessItem === "units_of_measurement");

  return (
    <InventoryClient
      initialData={rows.map((r) => ({
        ...r,
        openingStockQty: String(r.openingStockQty),
        openingStockRate: String(r.openingStockRate),
        gstPercent: r.gstPercent ? String(r.gstPercent) : null,
        consumptionRatio: r.consumptionRatio ? String(r.consumptionRatio) : null,
        shortagePercent: r.shortagePercent ? String(r.shortagePercent) : null,
      }))}
      taxRates={taxRates.map((t) => ({ ...t, taxPercent: String(t.taxPercent) }))}
      inventoryGroups={inventoryGroups}
      inventoryCategories={inventoryCategories}
      unitsList={unitsList}
      permissions={{
        inventory: {
          c: p?.c ?? false,
          u: p?.u ?? false,
          d: p?.d ?? false,
          e: p?.e ?? false,
        },
        groups: {
          c: pg?.c ?? false,
          u: pg?.u ?? false,
          d: pg?.d ?? false,
          e: pg?.e ?? false,
        },
        categories: {
          c: pc?.c ?? false,
          u: pc?.u ?? false,
          d: pc?.d ?? false,
          e: pc?.e ?? false,
        },
        units: {
          c: pu?.c ?? false,
          u: pu?.u ?? false,
          d: pu?.d ?? false,
          e: pu?.e ?? false,
        },
      }}
    />
  );
}
