import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mMills, mInventory, mTaxRates, mCompanies, tVouchers, tVoucherItems, mBrokersHaste } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import MillInwardClient from "./MillInwardClient";

export default async function MillInwardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [mills, inventory, taxRates, company, outwardVouchers, outwardItems, brokersHaste] = await Promise.all([
    db
      .select()
      .from(mMills)
      .where(and(eq(mMills.companyId, companyId), isNull(mMills.deletedOn)))
      .orderBy(mMills.millName),
    db
      .select()
      .from(mInventory)
      .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
      .orderBy(mInventory.inventoryName),
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "mill_outward"), isNull(tVouchers.deletedOn))),
    db
      .select({
        voucherItemId: tVoucherItems.voucherItemId,
        voucherId: tVoucherItems.voucherId,
        inventoryId: tVoucherItems.inventoryId,
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "mill_outward"), isNull(tVoucherItems.deletedOn))),
    db
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "mill_inward");

  return (
    <MillInwardClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      mills={mills.map((mill) => ({
        millId: mill.millId,
        millName: mill.millName,
        address: mill.address,
        gstNo: mill.gstNo,
      }))}
      inventory={inventory.map((item) => ({
        inventoryId: item.inventoryId,
        inventoryName: item.inventoryName,
        inventoryCode: item.inventoryCode,
        unit: item.unit,
        gstRateId: item.gstRateId,
        hsnCode: item.hsnCode,
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
        inventoryId: Number(item.inventoryId),
        hsnCode: item.hsnCode,
        pcs: item.pcs,
        quantity: String(item.quantity),
        fold: String(item.fold),
        rate: String(item.rate),
        jobType: item.jobType,
        jobRateType: item.jobRateType,
        gstRateId: item.gstRateId ? Number(item.gstRateId) : null,
      }))}
      brokersHaste={brokersHaste.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }))}
      canCreate={p?.c ?? false}
    />
  );
}
