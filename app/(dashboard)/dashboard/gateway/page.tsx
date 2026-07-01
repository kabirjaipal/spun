import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, mLedgerGroups, mJobs, mMills, mBrokersHaste } from "@/lib/db/schema";
import { and, isNull, eq } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GatewayClient from "./GatewayClient";

export default async function GatewayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  // Fetch all master data in parallel
  const [ledgers, ledgerGroups, jobs, mills, brokersHaste] = await Promise.all([
    db
      .select()
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
      .orderBy(mLedgers.ledgerName),
    db
      .select()
      .from(mLedgerGroups)
      .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)))
      .orderBy(mLedgerGroups.groupName),
    db
      .select()
      .from(mJobs)
      .where(and(eq(mJobs.companyId, companyId), isNull(mJobs.deletedOn)))
      .orderBy(mJobs.jobName),
    db
      .select()
      .from(mMills)
      .where(and(eq(mMills.companyId, companyId), isNull(mMills.deletedOn)))
      .orderBy(mMills.millName),
    db
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  
  const ledgersPerm = perms.find((x) => x.accessItem === "ledgers");
  const groupsPerm = perms.find((x) => x.accessItem === "ledger_groups");
  const jobsPerm = perms.find((x) => x.accessItem === "jobs");
  const millsPerm = perms.find((x) => x.accessItem === "mills");
  // Brokers/haste uses gateway permissions
  const gatewayPerm = perms.find((x) => x.accessItem === "gateway");

  return (
    <GatewayClient
      ledgers={ledgers.map((r) => ({
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
      }))}
      ledgerGroups={ledgerGroups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        parentGroupId: g.parentGroupId,
        isSystem: g.isSystem,
      }))}
      jobs={jobs}
      mills={mills}
      brokersHaste={brokersHaste.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }))}
      permissions={{
        ledgers: {
          c: ledgersPerm?.c ?? false,
          u: ledgersPerm?.u ?? false,
          d: ledgersPerm?.d ?? false,
          e: ledgersPerm?.e ?? false,
        },
        groups: {
          c: groupsPerm?.c ?? false,
          u: groupsPerm?.u ?? false,
          d: groupsPerm?.d ?? false,
          e: groupsPerm?.e ?? false,
        },
        jobs: {
          c: jobsPerm?.c ?? false,
          u: jobsPerm?.u ?? false,
          d: jobsPerm?.d ?? false,
          e: jobsPerm?.e ?? false,
        },
        mills: {
          c: millsPerm?.c ?? false,
          u: millsPerm?.u ?? false,
          d: millsPerm?.d ?? false,
          e: millsPerm?.e ?? false,
        },
        brokersHaste: {
          c: gatewayPerm?.c ?? false,
          u: gatewayPerm?.u ?? false,
          d: gatewayPerm?.d ?? false,
          e: gatewayPerm?.e ?? false,
        },
      }}
    />
  );
}
