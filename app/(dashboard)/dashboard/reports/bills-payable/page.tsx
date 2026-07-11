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
import BillsOutstandingClient from "./BillsOutstandingClient";

export default async function BillsPayablePage({
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

  // 2. Fetch purchase invoices within range
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
        eq(tVouchers.voucherType, "purchase"),
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

    // 5. Fetch payment adjustments
    adjustments = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherType: tVouchers.voucherType,
        billDetails: tVouchers.billDetails,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          inArray(tVouchers.voucherType, ["payment", "debit_note", "purchase_return"]),
          isNull(tVouchers.deletedOn),
          eq(tVouchers.partyId, partyIds[0]) // Filter to reduce matching or keep it simple since we match in JS
        )
      );
  }

  // Fallback adjustment query for all company payments if multiple parties are involved
  if (partyIds.length > 1) {
    adjustments = await db
      .select({
        voucherId: tVouchers.voucherId,
        voucherType: tVouchers.voucherType,
        billDetails: tVouchers.billDetails,
      })
      .from(tVouchers)
      .where(
        and(
          eq(tVouchers.companyId, companyId),
          inArray(tVouchers.voucherType, ["payment", "debit_note", "purchase_return"]),
          isNull(tVouchers.deletedOn)
        )
      );
  }

  // 6. Aggregate adjustments payments per invoice
  const paidAmounts: Record<number, number> = {};
  adjustments.forEach((adj) => {
    if (adj.billDetails && Array.isArray(adj.billDetails)) {
      adj.billDetails.forEach((item: any) => {
        if (item && typeof item === "object" && "voucherId" in item) {
          const vId = Number(item.voucherId);
          const amt = Number(item.amount) || 0;
          paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
        }
      });
    }
  });

  // 7. Calculate outstanding balances and due dates
  const outstandingBills = invoices
    .map((inv) => {
      const party = parties.find((p) => p.companyId === inv.partyId);
      const ledger = ledgers.find((l) => l.referenceId === inv.partyId);

      const netAmount = Number(inv.netAmount) || 0;
      const paidAmount = paidAmounts[inv.voucherId] || 0;
      const pendingAmount = netAmount - paidAmount;
      const creditDays = ledger?.creditDays ?? party?.dueDay ?? 10;

      // Due Date
      const invoiceDate = new Date(inv.voucherDate + "T00:00:00");
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      return {
        voucherId: inv.voucherId,
        voucherNo: inv.invoiceNo || inv.voucherNo,
        voucherDate: inv.voucherDate,
        partyName: party ? party.companyName : "Unknown Vendor",
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
  const p = perms.find((x) => x.accessItem === "bills_payable");
  const canExport = p?.e ?? false;

  return (
    <BillsOutstandingClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      type="payable"
      bills={outstandingBills}
      canExport={canExport}
    />
  );
}
