import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventoryGroups } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import InventoryGroupsClient from "./InventoryGroupsClient";

export default async function InventoryGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mInventoryGroups)
    .where(and(eq(mInventoryGroups.companyId, companyId), isNull(mInventoryGroups.deletedOn)))
    .orderBy(mInventoryGroups.groupName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "inventory_groups");

  return (
    <InventoryGroupsClient
      initialData={rows}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
