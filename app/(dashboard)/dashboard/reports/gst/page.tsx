import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mTaxRates,
  mLedgers,
  tVouchers,
  tVoucherItems,
  mInventory,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import GstReportClient from "./GstReportClient";

export default async function GstReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  // 1. Fetch Company Info
  const company = await db
    .select()
    .from(mCompanies)
    .where(eq(mCompanies.companyId, companyId))
    .limit(1)
    .then((res) => res[0]);

  if (!company) {
    redirect("/setup-company");
  }

  // Dynamic current FY (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fromDate = params.from || `${fyStartYear}-04-01`;
  const toDate = params.to || `${fyStartYear + 1}-03-31`;

  // 2. Fetch Defined GST Rates
  const taxRates = await db
    .select()
    .from(mTaxRates)
    .where(isNull(mTaxRates.deletedOn))
    .orderBy(mTaxRates.taxPercent);

  // 3. Fetch Vouchers with Ledger details, Items, and Tax Rates
  const rawVouchers = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherType: tVouchers.voucherType,
      voucherDate: tVouchers.voucherDate,
      totalAmount: tVouchers.totalAmount,
      taxAmount: tVouchers.taxAmount,
      netAmount: tVouchers.netAmount,
      partyName: mLedgers.ledgerName,
      partyGstNo: mLedgers.gstNo,
      itemId: tVoucherItems.voucherItemId,
      hsnCode: tVoucherItems.hsnCode,
      quantity: tVoucherItems.quantity,
      rate: tVoucherItems.rate,
      taxableAmount: tVoucherItems.taxableAmount,
      cgst: tVoucherItems.cgst,
      sgst: tVoucherItems.sgst,
      igst: tVoucherItems.igst,
      itemNetAmount: tVoucherItems.netAmount,
      taxPercent: mTaxRates.taxPercent,
      itemName: mInventory.inventoryName,
    })
    .from(tVouchers)
    .leftJoin(mLedgers, eq(tVouchers.partyId, mLedgers.ledgerId))
    .leftJoin(tVoucherItems, eq(tVouchers.voucherId, tVoucherItems.voucherId))
    .leftJoin(mTaxRates, eq(tVoucherItems.gstRateId, mTaxRates.taxRateId))
    .leftJoin(mInventory, eq(tVoucherItems.inventoryId, mInventory.inventoryId))
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate);

  // Group raw rows into vouchers with their items
  const voucherMap = new Map<number, any>();
  for (const row of rawVouchers) {
    if (!voucherMap.has(row.voucherId)) {
      voucherMap.set(row.voucherId, {
        voucherId: row.voucherId,
        voucherNo: row.voucherNo,
        voucherType: row.voucherType,
        voucherDate: row.voucherDate,
        totalAmount: Number(row.totalAmount),
        taxAmount: Number(row.taxAmount),
        netAmount: Number(row.netAmount),
        partyName: row.partyName,
        partyGstNo: row.partyGstNo,
        items: [],
      });
    }

    if (row.itemId) {
      voucherMap.get(row.voucherId).items.push({
        itemId: row.itemId,
        hsnCode: row.hsnCode,
        quantity: Number(row.quantity),
        rate: Number(row.rate),
        taxableAmount: Number(row.taxableAmount),
        cgst: Number(row.cgst),
        sgst: Number(row.sgst),
        igst: Number(row.igst),
        netAmount: Number(row.itemNetAmount),
        taxPercent: Number(row.taxPercent),
        itemName: row.itemName,
      });
    }
  }

  const vouchersList = Array.from(voucherMap.values());

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "gst_reports");
  const canExport = p?.e ?? false;

  return (
    <GstReportClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        state: company.state,
      }}
      taxRates={taxRates.map((tr) => ({
        taxRateId: tr.taxRateId,
        taxName: tr.taxName,
        taxPercent: Number(tr.taxPercent),
      }))}
      vouchers={vouchersList}
      canExport={canExport}
    />
  );
}
