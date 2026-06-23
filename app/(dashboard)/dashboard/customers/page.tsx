import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = BigInt(session.user.companyId);

  const rows = await db
    .select()
    .from(mCustomers)
    .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn)))
    .orderBy(mCustomers.customerName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "customers");

  return (
    <CustomersClient
      initialData={rows.map((r) => ({ ...r, customerId: r.customerId, openingBalance: String(r.openingBalance) }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
    />
  );
}
