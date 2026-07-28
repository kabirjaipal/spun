import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, tVouchers, mLedgers } from "@/lib/db/schema";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import AgeingAnalysisClient from "./AgeingAnalysisClient";

async function fetchOutstandingBills(companyId: number, voucherType: "purchase" | "sale", adjustmentTypes: string[]) {
  const invoices = await db
    .select({ voucherId: tVouchers.voucherId, voucherNo: tVouchers.voucherNo, voucherDate: tVouchers.voucherDate, netAmount: tVouchers.netAmount, partyId: tVouchers.partyId, invoiceNo: tVouchers.invoiceNo })
    .from(tVouchers)
    .where(and(eq(tVouchers.companyId, companyId), eq(tVouchers.voucherType, voucherType), isNull(tVouchers.deletedOn)));

  const partyIds = invoices.map(i => i.partyId).filter((id): id is number => id !== null);
  if (partyIds.length === 0) return [];

  const [parties, ledgers, adjustments] = await Promise.all([
    db.select({ companyId: mCompanies.companyId, companyName: mCompanies.companyName, dueDay: mCompanies.dueDay }).from(mCompanies).where(and(eq(mCompanies.parentCompanyId, companyId), isNull(mCompanies.deletedOn), inArray(mCompanies.companyId, partyIds))),
    db.select({ referenceId: mLedgers.referenceId, creditDays: mLedgers.creditDays }).from(mLedgers).where(and(eq(mLedgers.companyId, companyId), inArray(mLedgers.ledgerType, ["company", "customer"]), isNull(mLedgers.deletedOn), inArray(mLedgers.referenceId, partyIds))),
    db.select({ voucherId: tVouchers.voucherId, voucherType: tVouchers.voucherType, billDetails: tVouchers.billDetails, remarks: tVouchers.remarks, partyId: tVouchers.partyId, netAmount: tVouchers.netAmount }).from(tVouchers).where(and(eq(tVouchers.companyId, companyId), inArray(tVouchers.voucherType, adjustmentTypes), isNull(tVouchers.deletedOn), inArray(tVouchers.partyId, partyIds))),
  ]);

  const paidAmounts: Record<number, number> = {};
  const partyUnallocatedAmounts: Record<number, number> = {};

  adjustments.forEach(adj => {
    if (adj.remarks?.includes("[RETURN CHEQUE REVERSAL]")) {
      return;
    }
    const partyId = adj.partyId ? Number(adj.partyId) : 0;
    if (!partyId) return;

    let allocatedSum = 0;
    if (adj.billDetails && Array.isArray(adj.billDetails)) {
      (adj.billDetails as any[]).forEach((item: any) => {
        if (item && typeof item === "object" && "voucherId" in item) {
          const vId = Number(item.voucherId);
          const amt = Number(item.amount) || 0;
          paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
          allocatedSum += amt;
        }
      });
    }
    const netAmt = Number(adj.netAmount) || 0;
    const unallocated = Math.max(0, netAmt - allocatedSum);
    if (unallocated > 0) {
      partyUnallocatedAmounts[partyId] = (partyUnallocatedAmounts[partyId] || 0) + unallocated;
    }
  });

  // Group invoices by partyId
  const invoicesByParty: Record<number, typeof invoices> = {};
  invoices.forEach((inv) => {
    const partyId = inv.partyId ? Number(inv.partyId) : 0;
    if (!partyId) return;
    if (!invoicesByParty[partyId]) {
      invoicesByParty[partyId] = [];
    }
    invoicesByParty[partyId].push(inv);
  });

  // For each party, allocate unallocated amounts to invoices FIFO
  const billPendingAmounts: Record<number, number> = {};
  const billPaidAmounts: Record<number, number> = {};

  Object.keys(invoicesByParty).forEach((partyIdStr) => {
    const pId = Number(partyIdStr);
    const partyInvoices = invoicesByParty[pId];
    partyInvoices.sort((a, b) => new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime());

    let unallocatedPool = partyUnallocatedAmounts[pId] || 0;

    partyInvoices.forEach((inv) => {
      const netAmount = Number(inv.netAmount) || 0;
      const specificPaid = paidAmounts[inv.voucherId] || 0;
      let pending = Math.max(0, netAmount - specificPaid);
      let extraPaid = 0;

      if (unallocatedPool > 0 && pending > 0) {
         const allocation = Math.min(pending, unallocatedPool);
         pending -= allocation;
         unallocatedPool -= allocation;
         extraPaid = allocation;
      }

      billPendingAmounts[inv.voucherId] = pending;
      billPaidAmounts[inv.voucherId] = specificPaid + extraPaid;
    });
  });

  return invoices
    .map(inv => {
      const party = parties.find(p => p.companyId === inv.partyId);
      const ledger = ledgers.find(l => l.referenceId === inv.partyId);
      const netAmount = Number(inv.netAmount) || 0;
      const pendingAmount = billPendingAmounts[inv.voucherId] !== undefined ? billPendingAmounts[inv.voucherId] : netAmount;
      const paidAmount = billPaidAmounts[inv.voucherId] !== undefined ? billPaidAmounts[inv.voucherId] : 0;
      const creditDays = ledger?.creditDays ?? party?.dueDay ?? 0;
      const dueDate = new Date(inv.voucherDate + "T00:00:00");
      dueDate.setDate(dueDate.getDate() + creditDays);
      return {
        voucherId: inv.voucherId,
        voucherNo: inv.invoiceNo || inv.voucherNo,
        voucherDate: inv.voucherDate,
        partyName: party?.companyName ?? "Unknown Party",
        netAmount,
        paidAmount,
        pendingAmount,
        dueDate: dueDate.toISOString().split("T")[0],
        creditDays,
      };
    })
    .filter(b => b.pendingAmount > 0.01);
}

export default async function AgeingAnalysisPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const company = await db.select().from(mCompanies).where(eq(mCompanies.companyId, companyId)).limit(1).then(r => r[0]);
  if (!company) redirect("/setup-company");

  const [payableBills, receivableBills] = await Promise.all([
    fetchOutstandingBills(companyId, "purchase", ["payment", "debit_note", "purchase_return"]),
    fetchOutstandingBills(companyId, "sale", ["receipt", "credit_note", "sales_return"]),
  ]);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const canExport = perms.find(x => x.accessItem === "ageing_analysis")?.e ?? false;

  return (
    <AgeingAnalysisClient
      company={{ companyId: company.companyId, companyName: company.companyName, gstNo: company.gstNo, address: company.address }}
      payableBills={payableBills}
      receivableBills={receivableBills}
      canExport={canExport}
    />
  );
}
