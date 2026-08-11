import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mLedgers, mLedgerGroups } from "@/lib/db/schema";
import { and, isNull, eq, desc, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import PartiesClient from "./PartiesClient";

export default async function PartiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const rows = await db
    .select({
      companyId: mCompanies.companyId,
      parentCompanyId: mCompanies.parentCompanyId,
      companyName: mCompanies.companyName,
      gstNo: mCompanies.gstNo,
      phone: mCompanies.phone,
      email: mCompanies.email,
      address: mCompanies.address,
      panNo: mCompanies.panNo,
      pincode: mCompanies.pincode,
      state: mCompanies.state,
      currencySymbol: mCompanies.currencySymbol,
      nationName: mCompanies.nationName,
      bankName: mCompanies.bankName,
      bankAccountName: mCompanies.bankAccountName,
      accountNo: mCompanies.accountNo,
      ifscCode: mCompanies.ifscCode,
      branchName: mCompanies.branchName,
      accountType: mCompanies.accountType,
      msmeRegistered: mCompanies.msmeRegistered,
      msmeType: mCompanies.msmeType,
      msmeNo: mCompanies.msmeNo,
      gstApplicable: mCompanies.gstApplicable,
      gstType: mCompanies.gstType,
      stateCode: mCompanies.stateCode,
      city: mCompanies.city,
      companyType: mCompanies.companyType,
      marketCategory: mCompanies.marketCategory,
      financialYearStart: mCompanies.financialYearStart,
      dueDay: mCompanies.dueDay,
      groupId: mLedgers.groupId,
      ledgerId: mLedgers.ledgerId,
    })
    .from(mCompanies)
    .leftJoin(
      mLedgers,
      and(
        eq(mLedgers.referenceId, mCompanies.companyId),
        inArray(mLedgers.ledgerType, ["company", "customer"]),
        isNull(mLedgers.deletedOn)
      )
    )
    .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
    .orderBy(desc(mCompanies.createdOn));

  const groups = await db
    .select()
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)))
    .orderBy(mLedgerGroups.groupName);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "parties");

  return (
    <PartiesClient
      initialData={rows}
      groups={groups}
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      canExport={p?.e ?? false}
    />
  );
}
