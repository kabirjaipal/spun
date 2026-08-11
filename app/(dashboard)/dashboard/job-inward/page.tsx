import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mJobs, mInventory, mTaxRates, mCompanies, tVouchers, tVoucherItems, mBrokersHaste } from "@/lib/db/schema";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import JobInwardClient from "./JobInwardClient";

export default async function JobInwardPage({
  searchParams,
}: {
  searchParams: Promise<{ editId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;
  const editId = params.editId ? Number(params.editId) : undefined;

  let editVoucher: any = null;
  let editVoucherItems: any[] = [];
  if (editId) {
    const ev = await db.query.tVouchers.findFirst({
      where: and(
        eq(tVouchers.voucherId, editId),
        eq(tVouchers.companyId, companyId),
        isNull(tVouchers.deletedOn)
      ),
    });
    if (ev) {
      editVoucher = ev;
      editVoucherItems = await db
        .select()
        .from(tVoucherItems)
        .where(and(eq(tVoucherItems.voucherId, editId), isNull(tVoucherItems.deletedOn)));
    }
  }

  const [jobs, inventory, taxRates, company, outwardVouchers, outwardItems, brokersHaste] = await Promise.all([
    db
      .select()
      .from(mJobs)
      .where(and(eq(mJobs.companyId, companyId), isNull(mJobs.deletedOn)))
      .orderBy(mJobs.jobName),
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "job_outward"), isNull(tVouchers.deletedOn))),
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "job_outward"), isNull(tVoucherItems.deletedOn))),
    db
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
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
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "job_inward"), isNull(tVouchers.deletedOn)))
    .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
    .limit(50);

  const jobIds = pastVouchers.map((v) => v.partyId).filter(Boolean) as number[];
  const pastJobs = jobIds.length > 0
    ? await db.select().from(mJobs).where(inArray(mJobs.jobId, jobIds))
    : [];

  const voucherIds = pastVouchers.map((v) => v.voucherId);
  const items = voucherIds.length > 0
    ? await db
        .select({
          voucherId: tVoucherItems.voucherId,
          quantity: tVoucherItems.quantity,
          pcs: tVoucherItems.pcs,
        })
        .from(tVoucherItems)
        .where(and(inArray(tVoucherItems.voucherId, voucherIds), isNull(tVoucherItems.deletedOn)))
    : [];

  const qtyMap = items.reduce((acc, curr) => {
    const vId = Number(curr.voucherId);
    if (!acc[vId]) acc[vId] = { quantity: 0, pcs: 0 };
    acc[vId].quantity += Number(curr.quantity) || 0;
    acc[vId].pcs += curr.pcs || 0;
    return acc;
  }, {} as Record<number, { quantity: number; pcs: number }>);

  const vouchersWithParties = pastVouchers.map((v) => ({
    ...v,
    totalQuantity: qtyMap[v.voucherId]?.quantity || 0,
    totalPcs: qtyMap[v.voucherId]?.pcs || 0,
    party: pastJobs.find((j) => j.jobId === v.partyId) ? {
      name: pastJobs.find((j) => j.jobId === v.partyId)!.jobName,
      gstNo: pastJobs.find((j) => j.jobId === v.partyId)!.gstNo,
      address: pastJobs.find((j) => j.jobId === v.partyId)!.address,
    } : null,
  }));

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "job_inward");

  return (
    <JobInwardClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, state: company.state, jobPartyType: company.jobPartyType } : { companyName: `${APP_NAME} Company`, jobPartyType: "trader" }}
      jobs={jobs.map((job) => ({
        jobId: job.jobId,
        jobName: job.jobName,
        address: job.address,
        gstNo: job.gstNo,
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
      initialPastVouchers={vouchersWithParties}
      editVoucher={editVoucher ? {
        voucherId: editVoucher.voucherId,
        voucherNo: editVoucher.voucherNo,
        voucherDate: String(editVoucher.voucherDate),
        partyId: editVoucher.partyId,
        remarks: editVoucher.remarks,
        discountType: editVoucher.discountType,
        discountValue: editVoucher.discountValue ? Number(editVoucher.discountValue) : undefined,
        discountType2: editVoucher.discountType2,
        discountValue2: editVoucher.discountValue2 ? Number(editVoucher.discountValue2) : undefined,
        extraCharges: editVoucher.extraCharges ? Number(editVoucher.extraCharges) : undefined,
        extraChargesData: editVoucher.extraChargesData,
        lrNo: editVoucher.lrNo,
        lrDate: editVoucher.lrDate ? String(editVoucher.lrDate) : undefined,
        transport: editVoucher.transport,
        vehicleNo: editVoucher.vehicleNo,
        personName: editVoucher.personName,
        broker: editVoucher.broker,
        haste: editVoucher.haste,
        lotNo: editVoucher.lotNo,
        goodsName: editVoucher.goodsName,
      } : null}
      editVoucherItems={editVoucherItems.map(item => ({
        id: String(item.itemId),
        inventoryId: item.inventoryId ? String(item.inventoryId) : "",
        hsnCode: item.hsnCode || "",
        pcs: String(item.pcs || 0),
        quantity: String(item.quantity || 0),
        fold: String(item.fold || 100),
        rate: String(item.rate || 0),
        gstRateId: item.gstRateId ? String(item.gstRateId) : "",
        pieceMeters: item.pieceMeters ? (typeof item.pieceMeters === "string" ? JSON.parse(item.pieceMeters) : item.pieceMeters) : [],
      }))}
    />
  );
}
