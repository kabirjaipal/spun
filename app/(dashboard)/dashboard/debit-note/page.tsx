import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mSuppliers, mProducts, mLedgers, mTaxRates, mCompanies, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import DebitNoteClient from "./DebitNoteClient";

export default async function DebitNotePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [notes, suppliers, products, ledgers, taxRates, company] = await Promise.all([
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        partyId: tVouchers.partyId,
        totalAmount: tVouchers.totalAmount,
        netAmount: tVouchers.netAmount,
        remarks: tVouchers.remarks,
        supplierName: mSuppliers.supplierName,
      })
      .from(tVouchers)
      .leftJoin(mSuppliers, eq(tVouchers.partyId, mSuppliers.supplierId))
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "debit_note"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate))
      .limit(100),
    db
      .select()
      .from(mSuppliers)
      .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn)))
      .orderBy(mSuppliers.supplierName),
    db
      .select()
      .from(mProducts)
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn)))
      .orderBy(mProducts.productName),
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
  const p = perms.find((x) => x.accessItem === "debit_note");

  return (
    <DebitNoteClient
      initialNotes={notes.map(n => ({
        ...n,
        voucherDate: n.voucherDate ? new Date(n.voucherDate) : null
      }))}
      company={company ? { companyName: company.companyName, gstNo: company.gstNo, address: company.address } : { companyName: "Texora Company" }}
      suppliers={suppliers.map((s) => ({
        supplierId: s.supplierId,
        supplierName: s.supplierName,
        address: s.address,
        gstNo: s.gstNo,
      }))}
      products={products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        productCode: product.productCode,
        unit: product.unit,
        gstRateId: product.gstRateId,
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
