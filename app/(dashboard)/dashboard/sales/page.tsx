import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mTaxRates, mCompanies, tVouchers, tVoucherItems, mBrokersHaste, mLedgerGroups, mLedgers } from "@/lib/db/schema";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import SalesClient from "./SalesClient";

export default async function SalesPage({
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
    (g) => g.groupName.toLowerCase() === "sundry debtors"
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

  const [parties, inventory, taxRates, company, pastVouchers, brokersHaste] = await Promise.all([
    groupIds.length > 0
      ? db
          .select()
          .from(mCompanies)
          .innerJoin(
            mLedgers,
            and(
              eq(mLedgers.referenceId, mCompanies.companyId),
              eq(mLedgers.ledgerType, "company"),
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
          .then((rows) =>
            rows.map((r) => ({
              partyId: r.m_companies.companyId,
              partyName: r.m_companies.companyName,
              address: r.m_companies.address,
              gstNo: r.m_companies.gstNo,
              state: r.m_companies.state,
            }))
          )
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
    db
      .select()
      .from(mBrokersHaste)
      .where(and(eq(mBrokersHaste.companyId, companyId), isNull(mBrokersHaste.deletedOn)))
      .orderBy(mBrokersHaste.name),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "sales");

  // Build party map for past vouchers display
  const partyMap = Object.fromEntries(
    parties.map((c) => [c.partyId, { name: c.partyName, gstNo: c.gstNo, address: c.address }])
  );

  return (
    <SalesClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, companyType: company.companyType, state: company.state } : { companyName: `{APP_NAME} Company`, companyType: "general", state: null }}
      parties={parties.map((c) => ({
        partyId: c.partyId,
        partyName: c.partyName,
        address: c.address,
        gstNo: c.gstNo,
        state: c.state,
      }))}
      inventory={inventory.map((p) => ({
        inventoryId: p.inventoryId,
        inventoryName: p.inventoryName,
        inventoryCode: p.inventoryCode,
        unit: p.unit,
        gstRateId: p.gstRateId,
      }))}
      taxRates={taxRates.map((r) => ({
        taxRateId: r.taxRateId,
        taxName: r.taxName,
        taxPercent: String(r.taxPercent),
      }))}
      brokersHaste={brokersHaste.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
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
        party: v.partyId ? (partyMap[v.partyId] ?? null) : null,
      }))}
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
