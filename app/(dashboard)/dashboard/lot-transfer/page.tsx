import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mJobs, mMills, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc, isNotNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import LotTransferClient from "./LotTransferClient";

export default async function LotTransferPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  // 1. Fetch distinct outward lot numbers
  const outwardLotsQuery = await db
    .selectDistinct({
      lotNo: tVouchers.lotNo,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        isNotNull(tVouchers.lotNo),
        isNull(tVouchers.deletedOn)
      )
    );

  const lotNumbers = outwardLotsQuery.map((l) => l.lotNo).filter(Boolean) as string[];

  // 2. Fetch all parties (for target transfer selection)
  const [subCompanies, jobs, mills, recentTransfers] = await Promise.all([
    db.select().from(mCompanies).where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn))),
    db.select().from(mJobs).where(and(eq(mJobs.companyId, companyId), isNull(mJobs.deletedOn))),
    db.select().from(mMills).where(and(eq(mMills.companyId, companyId), isNull(mMills.deletedOn))),
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        lotNo: tVouchers.lotNo,
        partyId: tVouchers.partyId,
        remarks: tVouchers.remarks,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          eq(tVouchers.voucherType, "lot_transfer"),
          isNull(tVouchers.deletedOn)
        )
      )
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
  ]);

  // Combine target parties into a unified list
  const targetParties = [
    ...subCompanies.map((s) => ({ id: s.companyId, name: s.companyName, type: "Party" })),
    ...jobs.map((j) => ({ id: j.jobId, name: j.jobName, type: "Job Worker" })),
    ...mills.map((m) => ({ id: m.millId, name: m.millName, type: "Mill" })),
  ];

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "lot_transfer");

  return (
    <LotTransferClient
      lotNumbers={lotNumbers}
      targetParties={targetParties}
      initialTransfers={recentTransfers.map((v) => ({
        ...v,
        voucherDate: v.voucherDate ? new Date(v.voucherDate) : null,
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
