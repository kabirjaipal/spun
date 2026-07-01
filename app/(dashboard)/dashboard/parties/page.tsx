import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PartiesClient from "./PartiesClient";

export default async function PartiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mCompanies)
    .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
    .orderBy(mCompanies.companyName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "parties");

  return (
    <PartiesClient
      initialData={rows}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
