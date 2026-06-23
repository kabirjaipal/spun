import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import LedgersClient from "./LedgersClient";

export default async function LedgersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select()
    .from(mLedgers)
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .orderBy(mLedgers.ledgerName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ledgers");

  return (
    <LedgersClient
      initialData={rows.map((r) => ({ ledgerId: r.ledgerId, ledgerName: r.ledgerName, ledgerType: r.ledgerType, referenceId: r.referenceId }))}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
    />
  );
}
