import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventoryCategories } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import InventoryCategoriesClient from "./InventoryCategoriesClient";

export default async function InventoryCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mInventoryCategories)
    .where(and(eq(mInventoryCategories.companyId, companyId), isNull(mInventoryCategories.deletedOn)))
    .orderBy(mInventoryCategories.categoryName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "inventory_categories");

  return (
    <InventoryCategoriesClient
      initialData={rows}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
