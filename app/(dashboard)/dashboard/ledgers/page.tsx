import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, mLedgerGroups } from "@/lib/db/schema";
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

  const groups = await db
    .select()
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)))
    .orderBy(mLedgerGroups.groupName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ledgers");

  return (
    <LedgersClient
      initialData={rows.map((r) => ({
        ledgerId: r.ledgerId,
        ledgerName: r.ledgerName,
        ledgerType: r.ledgerType,
        referenceId: r.referenceId,
        shortName: r.shortName,
        address: r.address,
        groupId: r.groupId,
        gstNo: r.gstNo,
        msmeType: r.msmeType,
        panNo: r.panNo,
        isTdsApplicable: r.isTdsApplicable,
        tdsRate: r.tdsRate,
        creditDays: r.creditDays,
        rateOfInterest: r.rateOfInterest,
        stateCode: r.stateCode,
        hsnCode: r.hsnCode,
        cgst: r.cgst,
        sgst: r.sgst,
        igst: r.igst,
        gstRate: r.gstRate,
      }))}
      groups={groups}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
