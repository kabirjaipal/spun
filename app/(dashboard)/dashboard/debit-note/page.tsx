import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mLedgers, mTaxRates, mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc, ne, isNotNull } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import { tVoucherItems } from "@/lib/db/schema";
import DebitNoteClient from "./DebitNoteClient";

export default async function DebitNotePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [notes, companies, inventory, ledgers, taxRates, company, voucherItems, uniqueTdsSections] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        netAmount: tVouchers.netAmount,
        remarks: tVouchers.remarks,
        companyName: mCompanies.companyName,
        parentVoucherId: tVouchers.parentVoucherId,
        tdsSection: tVouchers.tdsSection,
        tdsRate: tVouchers.tdsRate,
        tdsAmount: tVouchers.tdsAmount,
      })
      .from(tVouchers)
      .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "debit_note"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select()
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
        voucherItemId: tVoucherItems.voucherItemId,
        voucherId: tVoucherItems.voucherId,
        ledgerId: tVoucherItems.ledgerId,
        hsnCode: tVoucherItems.hsnCode,
        taxableAmount: tVoucherItems.taxableAmount,
        gstRateId: tVoucherItems.gstRateId,
      })
      .from(tVoucherItems)
      .where(isNull(tVoucherItems.deletedOn)),
    db
      .selectDistinct({ tdsSection: tVouchers.tdsSection })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          isNotNull(tVouchers.tdsSection),
          ne(tVouchers.tdsSection, "")
        )
      ),
  ]);

  const customTdsSections = uniqueTdsSections.map((x) => x.tdsSection).filter(Boolean) as string[];

  const itemsByVoucher = voucherItems.reduce((acc: any, item) => {
    const vId = Number(item.voucherId);
    if (!acc[vId]) acc[vId] = [];
    acc[vId].push({
      id: String(item.voucherItemId),
      ledgerId: item.ledgerId ? String(item.ledgerId) : "",
      hsnCode: item.hsnCode || "",
      taxableAmount: String(item.taxableAmount || "0"),
      gstRateId: item.gstRateId ? String(item.gstRateId) : "",
    });
    return acc;
  }, {});

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "debit_note");

  return (
    <DebitNoteClient
      initialNotes={notes.map(n => ({
        ...n,
        voucherDate: n.voucherDate ? new Date(n.voucherDate) : null,
        lineItems: itemsByVoucher[n.voucherId] || [],
      }))}
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, state: company.state } : { companyName: `${APP_NAME} Company`, state: null }}
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
      canCreate={p?.c ?? false}
      canUpdate={p?.u ?? false}
      canDelete={p?.d ?? false}
      customTdsSections={customTdsSections}
    />
  );
}
