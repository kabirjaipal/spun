import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mInventory, mLedgers, mTaxRates } from "@/lib/db/schema";
import { and, eq, isNull, sql, or } from "drizzle-orm";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const company = await db.query.mCompanies.findFirst({
    where: eq(mCompanies.companyId, companyId),
  });

  if (!company) redirect("/setup-company");

  const companyDetails = {
    companyId: company.companyId,
    companyName: company.companyName,
    gstNo: company.gstNo,
    panNo: company.panNo,
    address: company.address,
    pincode: company.pincode,
    state: company.state,
    phone: company.phone,
    email: company.email,
    currencySymbol: company.currencySymbol,
    nationName: company.nationName,
    financialYearStart: company.financialYearStart,
    companyType: company.companyType,
    marketCategory: company.marketCategory,
    bankName: company.bankName,
    bankAccountName: company.bankAccountName,
    accountNo: company.accountNo,
    ifscCode: company.ifscCode,
    branchName: company.branchName,
    accountType: company.accountType,
    msmeRegistered: company.msmeRegistered,
    msmeType: company.msmeType,
    msmeNo: company.msmeNo,
    gstApplicable: company.gstApplicable,
    gstType: company.gstType,
    stateCode: company.stateCode,
    city: company.city,
  };

  return (
    <SettingsClient
      company={companyDetails}
    />
  );
}
