import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mTaxRates } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import TaxRatesClient from "./TaxRatesClient";

export default async function TaxRatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const rows = await db
    .select()
    .from(mTaxRates)
    .where(isNull(mTaxRates.deletedOn))
    .orderBy(mTaxRates.taxPercent);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "tax_rates");

  return (
    <TaxRatesClient
      initialData={rows.map((r) => ({ ...r, taxPercent: String(r.taxPercent) }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
    />
  );
}
