import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  tVouchers,
  mLedgers,
} from "@/lib/db/schema";
import { and, eq, isNull, gte, lte, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import BillsOutstandingClient from "../bills-payable/BillsOutstandingClient";

export default async function BillsReceivablePage({
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

  // 2. Fetch sales invoices within range
  const invoices = await db
    .select({
      voucherId: tVouchers.voucherId,
      voucherNo: tVouchers.voucherNo,
      voucherDate: tVouchers.voucherDate,
      netAmount: tVouchers.netAmount,
      partyId: tVouchers.partyId,
      invoiceNo: tVouchers.invoiceNo,
    })
    .from(tVouchers)
    .where(
      and(
        eq(tVouchers.companyId, companyId),
        eq(tVouchers.voucherType, "sale"),
        isNull(tVouchers.deletedOn),
        gte(tVouchers.voucherDate, fromDate),
        lte(tVouchers.voucherDate, toDate)
      )
    )
    .orderBy(tVouchers.voucherDate, tVouchers.voucherNo);

  const partyIds = invoices.map((inv) => inv.partyId).filter((id): id is number => id !== null);

  let parties: any[] = [];
  let ledgers: any[] = [];
  let adjustments: any[] = [];

  if (partyIds.length > 0) {
    // 3. Fetch parties details
    parties = await db
      .select({
        companyId: mCompanies.companyId,
        companyName: mCompanies.companyName,
        dueDay: mCompanies.dueDay,
      })
      .from(mCompanies)
      .where(
        and(
          eq(mCompanies.parentCompanyId, companyId),
          isNull(mCompanies.deletedOn),
          inArray(mCompanies.companyId, partyIds)
        )
      );

    // 4. Fetch ledgers for credit days mapping
    ledgers = await db
      .select({
        ledgerId: mLedgers.ledgerId,
        referenceId: mLedgers.referenceId,
        ledgerType: mLedgers.ledgerType,
        creditDays: mLedgers.creditDays,
      })
      .from(mLedgers)
      .where(
        and(
          eq(mLedgers.companyId, companyId),
          inArray(mLedgers.ledgerType, ["company", "customer"]),
          isNull(mLedgers.deletedOn),
          inArray(mLedgers.referenceId, partyIds)
        )
      );

    // 5. Fetch receipt adjustments for all involved parties
    adjustments = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherType: tVouchers.voucherType,
        billDetails: tVouchers.billDetails,
        remarks: tVouchers.remarks,
        partyId: tVouchers.partyId,
        netAmount: tVouchers.netAmount,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          inArray(tVouchers.voucherType, ["receipt", "credit_note", "sales_return"]),
          isNull(tVouchers.deletedOn),
          inArray(tVouchers.partyId, partyIds)
        )
      );
  }

  // 6. Aggregate adjustments receipts per invoice and unallocated pool
  const paidAmounts: Record<number, number> = {};
  const partyUnallocatedAmounts: Record<number, number> = {};

  adjustments.forEach((adj) => {
    if (adj.remarks?.includes("[RETURN CHEQUE REVERSAL]")) {
      return;
    }
    const partyId = adj.partyId ? Number(adj.partyId) : 0;
    if (!partyId) return;

    let allocatedSum = 0;
    if (adj.billDetails && Array.isArray(adj.billDetails)) {
      adj.billDetails.forEach((item: any) => {
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

  // 7. Calculate outstanding balances and due dates
  const outstandingBills = invoices
    .map((inv) => {
      const party = parties.find((p) => p.companyId === inv.partyId);
      const ledger = ledgers.find((l) => l.referenceId === inv.partyId);

      const netAmount = Number(inv.netAmount) || 0;
      const pendingAmount = billPendingAmounts[inv.voucherId] !== undefined ? billPendingAmounts[inv.voucherId] : netAmount;
      const paidAmount = billPaidAmounts[inv.voucherId] !== undefined ? billPaidAmounts[inv.voucherId] : 0;
      const creditDays = ledger?.creditDays ?? party?.dueDay ?? 10;

      // Due Date
      const invoiceDate = new Date(inv.voucherDate + "T00:00:00");
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      return {
        voucherId: inv.voucherId,
        voucherNo: inv.invoiceNo || inv.voucherNo,
        voucherDate: inv.voucherDate,
        partyName: party ? party.companyName : "Unknown Customer",
        netAmount,
        paidAmount,
        pendingAmount,
        dueDate: dueDate.toISOString().split("T")[0],
        creditDays,
      };
    })
    .filter((bill) => bill.pendingAmount > 0.01);

  // 8. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "bills_receivable");
  const canExport = p?.e ?? false;

  return (
    <BillsOutstandingClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      type="receivable"
      bills={outstandingBills}
      canExport={canExport}
    />
  );
}
