import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mLedgers, mTaxRates, mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import SalesClient from "./SalesClient";

export default async function SalesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [parties, inventory, ledgers, taxRates, company, pastVouchers] = await Promise.all([
    db
      .select({
        partyId: mCompanies.companyId,
        partyName: mCompanies.companyName,
        address: mCompanies.address,
        gstNo: mCompanies.gstNo,
      })
      .from(mCompanies)
      .where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn)))
      .orderBy(mCompanies.companyName),
    db
      .select()
      .from(mInventory)
      .where(and(eq(mInventory.companyId, companyId), isNull(mInventory.deletedOn)))
      .orderBy(mInventory.inventoryName),
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

  // Build party map for past vouchers display
  const partyMap = Object.fromEntries(
    parties.map((c) => [c.partyId, { name: c.partyName, gstNo: c.gstNo, address: c.address }])
  );

  return (
    <SalesClient
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, companyType: company.companyType } : { companyName: "Texora Company", companyType: "general" }}
      parties={parties.map((c) => ({
        partyId: c.partyId,
        partyName: c.partyName,
        address: c.address,
        gstNo: c.gstNo,
      }))}
      inventory={inventory.map((p) => ({
        inventoryId: p.inventoryId,
        inventoryName: p.inventoryName,
        inventoryCode: p.inventoryCode,
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
        party: v.partyId ? (partyMap[v.partyId] ?? null) : null,
      }))}
    />
  );
}
