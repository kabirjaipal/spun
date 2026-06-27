import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mSuppliers, mInventory, mLedgers, mTaxRates, mCompanies } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PurchaseClient from "./PurchaseClient";

export default async function PurchasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [suppliers, inventory, ledgers, taxRates, company] = await Promise.all([
    db
      .select()
      .from(mSuppliers)
      .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn)))
      .orderBy(mSuppliers.supplierName),
    db
      .select()
      .from(mInventory)
      .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
      .orderBy(mInventory.inventoryName),
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
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, companyType: company.companyType } : { companyName: "Texora Company", companyType: "general" }}
      suppliers={suppliers.map((supplier) => ({
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        address: supplier.address,
        gstNo: supplier.gstNo,
      }))}
      inventory={inventory.map((item) => ({
        inventoryId: item.inventoryId,
        inventoryName: item.inventoryName,
        inventoryCode: item.inventoryCode,
        unit: item.unit,
        gstRateId: item.gstRateId,
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
