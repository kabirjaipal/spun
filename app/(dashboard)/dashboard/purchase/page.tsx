import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mTaxRates, mCompanies, mBrokersHaste } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import PurchaseClient from "./PurchaseClient";

export default async function PurchasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [companies, inventory, taxRates, company, brokersHaste] = await Promise.all([
    db
      .select()
      .from(mCompanies)
      .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
      .orderBy(mCompanies.companyName),
    db
      .select()
      .from(mInventory)
      .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
      .orderBy(mInventory.inventoryName),
    db
      .select()
      .from(mTaxRates)
      .where(isNull(mTaxRates.deletedOn))
      .orderBy(mTaxRates.taxPercent),
    db.query.mCompanies.findFirst({
      where: eq(mCompanies.companyId, companyId),
    }),
    db
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "purchase");

  return (
    <PurchaseClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, companyType: company.companyType, state: company.state } : { companyName: `{APP_NAME} Company`, companyType: "general", state: null }}
      companies={companies.map((comp) => ({
        companyId: comp.companyId,
        companyName: comp.companyName,
        address: comp.address,
        gstNo: comp.gstNo,
        state: comp.state,
      }))}
      inventory={inventory.map((item) => ({
        inventoryId: item.inventoryId,
        inventoryName: item.inventoryName,
        inventoryCode: item.inventoryCode,
        unit: item.unit,
        gstRateId: item.gstRateId,
      }))}
      taxRates={taxRates.map((rate) => ({
        taxRateId: rate.taxRateId,
        taxName: rate.taxName,
        taxPercent: String(rate.taxPercent),
      }))}
      brokersHaste={brokersHaste.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
