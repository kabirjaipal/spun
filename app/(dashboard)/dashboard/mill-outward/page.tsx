import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mMills, mInventory, mTaxRates, mCompanies, mBrokersHaste, tVouchers, tVoucherItems } from "@/lib/db/schema";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import MillOutwardClient from "./MillOutwardClient";

export default async function MillOutwardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [mills, inventory, taxRates, company, brokersHaste, inwardVouchers, inwardItems] = await Promise.all([
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
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        lotNo: tVouchers.lotNo,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "mill_inward"), isNull(tVouchers.deletedOn))),
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "mill_inward"), isNull(tVoucherItems.deletedOn))),
  ]);

  const pastVouchers = await db
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
      lotNo: tVouchers.lotNo,
    })
    .from(tVouchers)
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "mill_outward"), isNull(tVouchers.deletedOn)))
    .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
    .limit(50);

  const millIds = pastVouchers.map((v) => v.partyId).filter(Boolean) as number[];
  const pastMills = millIds.length > 0
    ? await db.select().from(mMills).where(inArray(mMills.millId, millIds))
    : [];

  const vouchersWithParties = pastVouchers.map((v) => ({
    ...v,
    party: pastMills.find((m) => m.millId === v.partyId) ? {
      name: pastMills.find((m) => m.millId === v.partyId)!.millName,
      gstNo: pastMills.find((m) => m.millId === v.partyId)!.gstNo,
      address: pastMills.find((m) => m.millId === v.partyId)!.address,
    } : null,
  }));

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "mill_outward");

  return (
    <MillOutwardClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, state: company.state, jobPartyType: company.jobPartyType } : { companyName: `${APP_NAME} Company`, jobPartyType: "trader" }}
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
      brokersHaste={brokersHaste.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
      }))}
      inwardVouchers={inwardVouchers.map((v) => ({
        voucherId: Number(v.voucherId),
        voucherNo: v.voucherNo,
        voucherDate: String(v.voucherDate),
        partyId: v.partyId ? Number(v.partyId) : null,
        lotNo: v.lotNo,
      }))}
      inwardItems={inwardItems.map((item) => ({
        voucherItemId: Number(item.voucherItemId),
        voucherId: Number(item.voucherId),
        inventoryId: Number(item.inventoryId),
        hsnCode: item.hsnCode,
        pcs: item.pcs,
        quantity: String(item.quantity),
        fold: String(item.fold),
        rate: String(item.rate),
        jobType: item.jobType,
        jobRateType: item.jobRateType as "pcs" | "mtr" | null,
        gstRateId: item.gstRateId ? Number(item.gstRateId) : null,
      }))}
      canCreate={p?.c ?? false}
      initialPastVouchers={vouchersWithParties}
    />
  );
}
