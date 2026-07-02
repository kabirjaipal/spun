import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mLedgers, mTaxRates, mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import CreditNoteClient from "./CreditNoteClient";

export default async function CreditNotePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [notes, parties, inventory, ledgers, taxRates, company] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        netAmount: tVouchers.netAmount,
        remarks: tVouchers.remarks,
        partyName: mCompanies.companyName,
      })
      .from(tVouchers)
      .leftJoin(mCompanies, eq(tVouchers.partyId, mCompanies.companyId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "credit_note"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select({
        partyId: mCompanies.companyId,
        partyName: mCompanies.companyName,
        address: mCompanies.address,
        gstNo: mCompanies.gstNo,
        state: mCompanies.state,
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
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "credit_note");

  return (
    <CreditNoteClient
      initialNotes={notes.map(n => ({
        ...n,
        voucherDate: n.voucherDate ? new Date(n.voucherDate) : null
      }))}
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address, state: company.state } : { companyName: `{APP_NAME} Company`, state: null }}
      parties={parties.map((c) => ({
        partyId: c.partyId,
        partyName: c.partyName,
        address: c.address,
        gstNo: c.gstNo,
        state: c.state,
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
    />
  );
}
