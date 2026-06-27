import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mJobs, mProducts, mLedgers, mTaxRates, mCompanies, tVouchers, tVoucherItems } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import JobInwardClient from "./JobInwardClient";

export default async function JobInwardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [jobs, products, ledgers, taxRates, company, outwardVouchers, outwardItems] = await Promise.all([
    db
      .select()
      .from(mJobs)
      .where(and(eq(mJobs.companyId, companyId), isNull(mJobs.deletedOn)))
      .orderBy(mJobs.jobName),
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
        partyId: tVouchers.partyId,
        lotNo: tVouchers.lotNo,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "job_outward"), isNull(tVouchers.deletedOn))),
    db
      .select({
        voucherItemId: tVoucherItems.voucherItemId,
        voucherId: tVoucherItems.voucherId,
        productId: tVoucherItems.productId,
        ledgerId: tVoucherItems.ledgerId,
        hsnCode: tVoucherItems.hsnCode,
        pcs: tVoucherItems.pcs,
        quantity: tVoucherItems.quantity,
        fold: tVoucherItems.fold,
        rate: tVoucherItems.rate,
        jobType: tVoucherItems.jobType,
        jobRateType: tVoucherItems.jobRateType,
        gstRateId: tVoucherItems.gstRateId,
      })
      .from(tVoucherItems)
      .innerJoin(tVouchers, eq(tVoucherItems.voucherId, tVouchers.voucherId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "job_outward"), isNull(tVoucherItems.deletedOn))),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "job_inward");

  return (
    <JobInwardClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      jobs={jobs.map((job) => ({
        jobId: job.jobId,
        jobName: job.jobName,
        address: job.address,
        gstNo: job.gstNo,
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
      }))}
      taxRates={taxRates.map((rate) => ({
        taxRateId: rate.taxRateId,
        taxName: rate.taxName,
        taxPercent: String(rate.taxPercent),
      }))}
      outwardVouchers={outwardVouchers.map((v) => ({
        voucherId: Number(v.voucherId),
        voucherNo: v.voucherNo,
        voucherDate: String(v.voucherDate),
        partyId: v.partyId ? Number(v.partyId) : null,
        lotNo: v.lotNo,
      }))}
      outwardItems={outwardItems.map((item) => ({
        voucherItemId: Number(item.voucherItemId),
        voucherId: Number(item.voucherId),
        productId: Number(item.productId),
        ledgerId: Number(item.ledgerId),
        hsnCode: item.hsnCode,
        pcs: item.pcs,
        quantity: String(item.quantity),
        fold: String(item.fold),
        rate: String(item.rate),
        jobType: item.jobType,
        jobRateType: item.jobRateType,
        gstRateId: item.gstRateId ? Number(item.gstRateId) : null,
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
