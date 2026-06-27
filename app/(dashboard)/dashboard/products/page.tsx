import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mProducts, mTaxRates, mInventoryGroups, mInventoryCategories, mUnitsOfMeasurement } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [rows, taxRates, inventoryGroups, inventoryCategories, unitsList] = await Promise.all([
    db
      .select({
        productId: mProducts.productId,
        productCode: mProducts.productCode,
        productName: mProducts.productName,
        unit: mProducts.unit,
        gstRateId: mProducts.gstRateId,
        openingStockQty: mProducts.openingStockQty,
        openingStockRate: mProducts.openingStockRate,
        taxName: mTaxRates.taxName,
        taxPercent: mTaxRates.taxPercent,
        hsnCode: mProducts.hsnCode,
        inventoryGroupId: mProducts.inventoryGroupId,
        inventoryCategoryId: mProducts.inventoryCategoryId,
        gstType: mProducts.gstType,
        gstPercent: mProducts.gstPercent,
        isConsumable: mProducts.isConsumable,
        consumeWithProductId: mProducts.consumeWithProductId,
        consumptionRatio: mProducts.consumptionRatio,
        shortagePercent: mProducts.shortagePercent,
      })
      .from(mProducts)
      .leftJoin(mTaxRates, eq(mProducts.gstRateId, mTaxRates.taxRateId))
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
      .orderBy(mProducts.productName),
    db.select().from(mTaxRates).where(isNull(mTaxRates.deletedOn)).orderBy(mTaxRates.taxPercent),
    db.select().from(mInventoryGroups).where(and(eq(mInventoryGroups.companyId, companyId), isNull(mInventoryGroups.deletedOn))).orderBy(mInventoryGroups.groupName),
    db.select().from(mInventoryCategories).where(and(eq(mInventoryCategories.companyId, companyId), isNull(mInventoryCategories.deletedOn))).orderBy(mInventoryCategories.categoryName),
    db.select().from(mUnitsOfMeasurement).where(and(eq(mUnitsOfMeasurement.companyId, companyId), isNull(mUnitsOfMeasurement.deletedOn))).orderBy(mUnitsOfMeasurement.unitCode),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "products");

  return (
    <ProductsClient
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
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
