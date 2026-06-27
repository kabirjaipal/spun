import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgerGroups } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import LedgerGroupsClient from "./LedgerGroupsClient";

export default async function LedgerGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const groups = await db
    .select()
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)))
    .orderBy(mLedgerGroups.groupName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ledger_groups");

  return (
    <LedgerGroupsClient
      initialData={groups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        parentGroupId: g.parentGroupId,
        isSystem: g.isSystem,
      }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
