import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mSuppliers, mProducts, mLedgers, mTaxRates, mCompanies } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PurchaseClient from "./PurchaseClient";

export default async function PurchasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [suppliers, products, ledgers, taxRates, company] = await Promise.all([
    db
      .select()
      .from(mSuppliers)
      .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn)))
      .orderBy(mSuppliers.supplierName),
    db
      .select()
      .from(mProducts)
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
      .orderBy(mProducts.productName),
    db
      .select()
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
      .orderBy(mLedgers.ledgerName),
    db
      .select()
      .from(mTaxRates)
      .where(isNull(mTaxRates.deletedOn))
      .orderBy(mTaxRates.taxPercent),
    db.query.mCompanies.findFirst({
      where: eq(mCompanies.companyId, companyId),
    }),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "purchase");

  return (
    <PurchaseClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      suppliers={suppliers.map((supplier) => ({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        address: supplier.address,
        gstNo: supplier.gstNo,
      }))}
      products={products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        productCode: product.productCode,
        unit: product.unit,
        gstRateId: product.gstRateId,
      }))}
      ledgers={ledgers.map((ledger) => ({
        ledgerId: ledger.ledgerId,
        ledgerName: ledger.ledgerName,
        ledgerType: ledger.ledgerType,
      }))}
      taxRates={taxRates.map((rate) => ({
        taxRateId: rate.taxRateId,
        taxName: rate.taxName,
        taxPercent: String(rate.taxPercent),
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
