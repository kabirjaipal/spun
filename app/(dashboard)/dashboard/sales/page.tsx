import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCustomers, mProducts, mLedgers, mTaxRates, mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SalesClient from "./SalesClient";

export default async function SalesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [customers, products, ledgers, taxRates, company, pastVouchers] = await Promise.all([
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
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        status: tVouchers.status,
        totalAmount: tVouchers.totalAmount,
        taxAmount: tVouchers.taxAmount,
        netAmount: tVouchers.netAmount,
        remarks: tVouchers.remarks,
        partyId: tVouchers.partyId,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "sale"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
      .limit(50),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "sales");

  // Build customer map for past vouchers display
  const customerMap = Object.fromEntries(
    customers.map((c) => [c.customerId, { name: c.customerName, gstNo: c.gstNo, address: c.address }])
  );

  return (
    <SalesClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      customers={customers.map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        address: c.address,
        gstNo: c.gstNo,
      }))}
      products={products.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productCode: p.productCode,
        unit: p.unit,
        gstRateId: p.gstRateId,
      }))}
      ledgers={ledgers.map((l) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        ledgerType: l.ledgerType,
        referenceId: l.referenceId,
      }))}
      taxRates={taxRates.map((r) => ({
        taxRateId: r.taxRateId,
        taxName: r.taxName,
        taxPercent: String(r.taxPercent),
      }))}
      canCreate={p?.c ?? false}
      pastVouchers={pastVouchers.map((v) => ({
        voucherId: v.voucherId,
        voucherNo: v.voucherNo,
        voucherDate: String(v.voucherDate),
        status: v.status,
        totalAmount: Number(v.totalAmount),
        taxAmount: Number(v.taxAmount),
        netAmount: Number(v.netAmount),
        remarks: v.remarks,
        party: v.partyId ? (customerMap[v.partyId] ?? null) : null,
      }))}
    />
  );
}
