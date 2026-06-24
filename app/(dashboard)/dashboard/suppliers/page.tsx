import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mSuppliers } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SuppliersClient from "./SuppliersClient";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mSuppliers)
    .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn)))
    .orderBy(mSuppliers.supplierName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "suppliers");

  return (
    <SuppliersClient
      initialData={rows.map((r) => ({ ...r, openingBalance: String(r.openingBalance) }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
