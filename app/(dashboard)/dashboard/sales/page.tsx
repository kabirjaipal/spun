import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mProducts, mLedgers, mTaxRates, mCompanies } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SalesClient from "./SalesClient";

export default async function SalesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [customers, products, ledgers, taxRates, company] = await Promise.all([
    db
      .select()
      .from(mCustomers)
      .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn)))
      .orderBy(mCustomers.customerName),
    db
      .select()
      .from(mProducts)
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
      .orderBy(mProducts.productName),
    db
      .select()
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
      .orderBy(mLedgers.ledgerName),
    db
      .select()
      .from(mTaxRates)
      .where(isNull(mTaxRates.deletedOn))
      .orderBy(mTaxRates.taxPercent),
    db.query.mCompanies.findFirst({
      where: eq(mCompanies.companyId, companyId),
    }),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "sales");

  return (
    <SalesClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      customers={customers.map((customer) => ({
        customerId: customer.customerId,
        customerName: customer.customerName,
        address: customer.address,
        gstNo: customer.gstNo,
      }))}
      products={products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        productCode: product.productCode,
        unit: product.unit,
        gstRateId: product.gstRateId,
      }))}
      ledgers={ledgers.map((ledger) => ({
        ledgerId: ledger.ledgerId,
        ledgerName: ledger.ledgerName,
        ledgerType: ledger.ledgerType,
        referenceId: ledger.referenceId,
      }))}
      taxRates={taxRates.map((rate) => ({
        taxRateId: rate.taxRateId,
        taxName: rate.taxName,
        taxPercent: String(rate.taxPercent),
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
