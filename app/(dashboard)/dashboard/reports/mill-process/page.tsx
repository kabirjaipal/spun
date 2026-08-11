import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mInventory,
  mMills,
  tVouchers,
  tVoucherItems,
} from "@/lib/db/schema";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import MillProcessClient from "./MillProcessClient";

export default async function MillProcessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  // 1. Fetch Tenant Company Info
  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  // 2. Fetch all Mills
  const mills = await db
    .select({
      millId: mMills.millId,
      millName: mMills.millName,
      gstNo: mMills.gstNo,
      address: mMills.address,
      msmeRegistered: mMills.msmeRegistered,
      msmeType: mMills.msmeType,
    })
    .from(mMills)
    .where(and(eq(mMills.companyId, companyId), isNull(mMills.deletedOn)))
    .orderBy(mMills.millName);

  // 3. Fetch all Items
  const items = await db
    .select({
      inventoryId: mInventory.inventoryId,
      inventoryName: mInventory.inventoryName,
      inventoryCode: mInventory.inventoryCode,
      unit: mInventory.unit,
    })
    .from(mInventory)
    .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
    .orderBy(mInventory.inventoryName);

  // 4. Fetch all Supplier/Purchase Parties (all child companies under tenant)
  const purchaseParties = await db
    .select({
      companyId: mCompanies.companyId,
      companyName: mCompanies.companyName,
      gstNo: mCompanies.gstNo,
      address: mCompanies.address,
    })
    .from(mCompanies)
    .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
    .orderBy(mCompanies.companyName);

  // 5. Fetch all Mill Vouchers (Outward and Inward)
  const vouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
      partyId: tVouchers.partyId,
      remarks: tVouchers.remarks,
      totalAmount: tVouchers.totalAmount,
      taxAmount: tVouchers.taxAmount,
      netAmount: tVouchers.netAmount,
      lotNo: tVouchers.lotNo,
      invoiceNo: tVouchers.invoiceNo,
      invoiceDate: tVouchers.invoiceDate,
      parentVoucherId: tVouchers.parentVoucherId,
      fromPartyId: tVouchers.fromPartyId,
      tdsRate: tVouchers.tdsRate,
      tdsAmount: tVouchers.tdsAmount,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        inArray(tVouchers.voucherType, ["mill_outward", "mill_inward"]),
        isNull(tVouchers.deletedOn)
      )
    )
    .orderBy(tVouchers.voucherDate);

  // 6. Fetch Voucher Items for Mill Vouchers
  const voucherIds = vouchers.map((v) => v.voucherId);
  const voucherItemsList = voucherIds.length > 0
    ? await db
        .select({
          voucherItemId: tVoucherItems.voucherItemId,
          voucherId: tVoucherItems.voucherId,
          inventoryId: tVoucherItems.inventoryId,
          pcs: tVoucherItems.pcs,
          quantity: tVoucherItems.quantity,
          rate: tVoucherItems.rate,
          taxableAmount: tVoucherItems.taxableAmount,
          cgst: tVoucherItems.cgst,
          sgst: tVoucherItems.sgst,
          igst: tVoucherItems.igst,
          netAmount: tVoucherItems.netAmount,
        })
        .from(tVoucherItems)
        .where(and(inArray(tVoucherItems.voucherId, voucherIds), isNull(tVoucherItems.deletedOn)))
    : [];

  // 7. Fetch all Purchase Vouchers for Lot matching & supplier resolving
  const purchaseVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      invoiceNo: tVouchers.invoiceNo,
      voucherDate: tVouchers.voucherDate,
      partyId: tVouchers.partyId,
      lotNo: tVouchers.lotNo,
    })
    .from(tVouchers)
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "purchase"), isNull(tVouchers.deletedOn)));

  // 8. Permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "mill_process_report");
  const canExport = p?.e ?? false;

  return (
    <MillProcessClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      mills={mills}
      items={items}
      purchaseParties={purchaseParties}
      vouchers={vouchers.map((v) => ({
        ...v,
        totalAmount: Number(v.totalAmount),
        taxAmount: Number(v.taxAmount),
        netAmount: Number(v.netAmount),
        tdsRate: v.tdsRate ? Number(v.tdsRate) : null,
        tdsAmount: v.tdsAmount ? Number(v.tdsAmount) : null,
      }))}
      voucherItems={voucherItemsList.map((vi) => ({
        ...vi,
        quantity: Number(vi.quantity),
        rate: Number(vi.rate),
        taxableAmount: Number(vi.taxableAmount),
        cgst: Number(vi.cgst),
        sgst: Number(vi.sgst),
        igst: Number(vi.igst),
        netAmount: Number(vi.netAmount),
      }))}
      purchaseVouchers={purchaseVouchers}
      canExport={canExport}
    />
  );
}
