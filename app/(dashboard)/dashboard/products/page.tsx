import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mProducts, mTaxRates } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = BigInt(session.user.companyId);

  const [rows, taxRates] = await Promise.all([
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
      })
      .from(mProducts)
      .leftJoin(mTaxRates, eq(mProducts.gstRateId, mTaxRates.taxRateId))
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
      .orderBy(mProducts.productName),
    db.select().from(mTaxRates).where(isNull(mTaxRates.deletedOn)).orderBy(mTaxRates.taxPercent),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "products");

  return (
    <ProductsClient
      initialData={rows.map((r) => ({
        ...r,
        openingStockQty: String(r.openingStockQty),
        openingStockRate: String(r.openingStockRate),
      }))}
      taxRates={taxRates.map((t) => ({ ...t, taxPercent: String(t.taxPercent) }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
    />
  );
}
