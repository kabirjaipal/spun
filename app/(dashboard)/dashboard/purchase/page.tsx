import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mTaxRates, mCompanies, mBrokersHaste, mLedgerGroups, mLedgers, tVouchers, tVoucherItems } from "@/lib/db/schema";
import { and, eq, isNull, inArray, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import PurchaseClient from "./PurchaseClient";

export default async function PurchasePage({
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

  const allGroups = await db
    .select({
      groupId: mLedgerGroups.groupId,
      groupName: mLedgerGroups.groupName,
      parentGroupId: mLedgerGroups.parentGroupId,
    })
    .from(mLedgerGroups)
    .where(and(eq(mLedgerGroups.companyId, companyId), isNull(mLedgerGroups.deletedOn)));

  const targetGroup = allGroups.find(
    (g) => g.groupName.toLowerCase() === "sundry creditors"
  );
  
  const groupIds: number[] = [];
  if (targetGroup) {
    const getDescendants = (parentId: number) => {
      groupIds.push(parentId);
      allGroups.forEach((g) => {
        if (g.parentGroupId === parentId) {
          getDescendants(g.groupId);
        }
      });
    };
    getDescendants(targetGroup.groupId);
  }

  const [companies, inventory, taxRates, company, brokersHaste, pastVouchers] = await Promise.all([
    groupIds.length > 0
      ? db
          .select()
          .from(mCompanies)
          .innerJoin(
            mLedgers,
            and(
              eq(mLedgers.referenceId, mCompanies.companyId),
              inArray(mLedgers.ledgerType, ["company", "customer"]),
              isNull(mLedgers.deletedOn)
            )
          )
          .where(
            and(
              eq(mCompanies.parentCompanyId, companyId),
              isNull(mCompanies.deletedOn),
              inArray(mLedgers.groupId, groupIds)
            )
          )
          .orderBy(mCompanies.companyName)
          .then((rows) => rows.map((r) => r.m_companies))
      : Promise.resolve([]),
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
        status: tVouchers.status,
        totalAmount: tVouchers.totalAmount,
        taxAmount: tVouchers.taxAmount,
        netAmount: tVouchers.netAmount,
        remarks: tVouchers.remarks,
        partyId: tVouchers.partyId,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "purchase"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
      .limit(50)
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "purchase");

  // Resolve parties for the past vouchers
  const partyIds = pastVouchers.map((v) => v.partyId).filter(Boolean) as number[];
  const pastParties = partyIds.length > 0
    ? await db.select().from(mCompanies).where(inArray(mCompanies.companyId, partyIds))
    : [];

  const partyMap = Object.fromEntries(
    pastParties.map((c) => [c.companyId, { name: c.companyName, gstNo: c.gstNo, address: c.address }])
  );

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
    party: v.partyId ? (partyMap[v.partyId] ?? null) : null,
  }));

  return (
    <PurchaseClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, companyType: company.companyType, state: company.state } : { companyName: `${APP_NAME} Company`, companyType: "general", state: null }}
      companies={companies.map((comp) => ({
        companyId: comp.companyId,
        companyName: comp.companyName,
        address: comp.address,
        gstNo: comp.gstNo,
        state: comp.state,
      }))}
      inventory={inventory.map((item) => ({
        inventoryId: item.inventoryId,
        inventoryName: item.inventoryName,
        inventoryCode: item.inventoryCode,
        unit: item.unit,
        gstRateId: item.gstRateId,
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
      canCreate={p?.c ?? false}
      pastVouchers={vouchersWithParties}
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
