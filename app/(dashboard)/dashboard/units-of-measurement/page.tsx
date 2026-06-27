import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mUnitsOfMeasurement } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import UnitsOfMeasurementClient from "./UnitsOfMeasurementClient";

export default async function UnitsOfMeasurementPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mUnitsOfMeasurement)
    .where(and(eq(mUnitsOfMeasurement.companyId, companyId), isNull(mUnitsOfMeasurement.deletedOn)))
    .orderBy(mUnitsOfMeasurement.unitCode);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "units_of_measurement");

  return (
    <UnitsOfMeasurementClient
      initialData={rows}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
