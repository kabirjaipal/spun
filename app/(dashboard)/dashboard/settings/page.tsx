import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mCustomers, mSuppliers, mProducts, mLedgers, mTaxRates } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
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

  const [customerCount, supplierCount, productCount, ledgerCount, taxRateCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(mCustomers)
      .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mSuppliers)
      .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mProducts)
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mTaxRates)
      .where(isNull(mTaxRates.deletedOn)),
  ]);

  const companyDetails = {
    companyId: company.companyId,
    companyName: company.companyName,
    gstNo: company.gstNo,
    panNo: company.panNo,
    address: company.address,
    financialYearStart: company.financialYearStart,
    companyType: company.companyType,
    marketCategory: company.marketCategory,
    bankName: company.bankName,
    bankAccountName: company.bankAccountName,
    accountNo: company.accountNo,
    ifscCode: company.ifscCode,
    branchName: company.branchName,
    accountType: company.accountType,
  };

  const counts = {
    customers: customerCount[0]?.count ?? 0,
    suppliers: supplierCount[0]?.count ?? 0,
    products: productCount[0]?.count ?? 0,
    ledgers: ledgerCount[0]?.count ?? 0,
    taxRates: taxRateCount[0]?.count ?? 0,
  };

  return <SettingsClient company={companyDetails} counts={counts} />;
}
