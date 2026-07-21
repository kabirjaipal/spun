import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mInventory, mLedgers, mTaxRates, mCompanies, mLedgerGroups, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, inArray, desc } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import { APP_NAME } from "@/lib/constants";
import PurchaseReturnClient from "./PurchaseReturnClient";

export default async function PurchaseReturnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

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

  const [companies, inventory, ledgers, taxRates, company, pastVouchers] = await Promise.all([
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
          .then((rows) => rows.map((r) => r.m_companies))
      : Promise.resolve([]),
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
      .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, "purchase_return"), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
      .limit(50)
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "purchase") || { c: true }; // Allow fallback if purchase permission is accessible

  // Resolve parties for the past vouchers
  const partyIds = pastVouchers.map((v) => v.partyId).filter(Boolean) as number[];
  const pastParties = partyIds.length > 0
    ? await db.select().from(mCompanies).where(inArray(mCompanies.companyId, partyIds))
    : [];

  const vouchersWithParties = pastVouchers.map((v) => ({
    ...v,
    party: pastParties.find((p) => p.companyId === v.partyId) ? {
      name: pastParties.find((p) => p.companyId === v.partyId)!.companyName,
      gstNo: pastParties.find((p) => p.companyId === v.partyId)!.gstNo,
      address: pastParties.find((p) => p.companyId === v.partyId)!.address,
    } : null,
  }));

  return (
    <PurchaseReturnClient
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
      initialPastVouchers={vouchersWithParties}
    />
  );
}
