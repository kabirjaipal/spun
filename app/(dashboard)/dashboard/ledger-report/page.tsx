import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  mCompanies,
  mLedgers,
  tVoucherEntries,
  tVouchers,
} from "@/lib/db/schema";
import { and, eq, isNull, sql, gte, lte, lt, inArray } from "drizzle-orm";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";
import LedgerReportClient from "./LedgerReportClient";

export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ledgerId?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);
  const params = await searchParams;

  // Dynamically compute current financial year (April start)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;
  const defaultTo = `${fyStartYear + 1}-03-31`;

  const fromDate = params.from || defaultFrom;
  const toDate = params.to || defaultTo;
  const ledgerId = params.ledgerId ? Number(params.ledgerId) : null;

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

  // 2. Fetch all ledgers with their balance summary — date-filtered to match detail view
  const ledgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      referenceId: mLedgers.referenceId,
      debit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      activityCount: sql<number>`count(${tVoucherEntries.voucherEntryId})`,
      lastPosted: sql<string>`max(${tVouchers.voucherDate})`,
    })
    .from(mLedgers)
    .leftJoin(
      tVoucherEntries,
      and(
        eq(mLedgers.ledgerId, tVoucherEntries.ledgerId),
        // only count entries whose voucher is in the selected period
        sql`${tVoucherEntries.voucherId} in (
          select voucher_id from t_vouchers
          where deleted_on is null
          and voucher_date >= ${fromDate}
          and voucher_date <= ${toDate}
        )`
      )
    )
    .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType, mLedgers.referenceId)
    .orderBy(mLedgers.ledgerName);

  // 3. Fetch vouchers and statement entries if a specific ledger is selected
  let selectedLedger = null;
  let vouchers: any[] = [];
  let ledgerEntries: any[] = [];
  let openingBalance = 0;

  if (ledgerId) {
    const rawSelected = ledgers.find((l) => l.ledgerId === ledgerId);
    if (rawSelected) {
      selectedLedger = {
        ledgerId: rawSelected.ledgerId,
        ledgerName: rawSelected.ledgerName,
        ledgerType: rawSelected.ledgerType,
        referenceId: rawSelected.referenceId ? Number(rawSelected.referenceId) : null,
        debit: Number(rawSelected.debit),
        credit: Number(rawSelected.credit),
        activityCount: Number(rawSelected.activityCount),
        lastPosted: rawSelected.lastPosted,
      };

      // 3.1 Calculate Opening Balance (debits minus credits before fromDate)
      const prevEntries = await db
        .select({
          entryType: tVoucherEntries.entryType,
          amount: tVoucherEntries.amount,
        })
        .from(tVoucherEntries)
        .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
        .where(
          and(
            eq(tVoucherEntries.ledgerId, ledgerId),
            isNull(tVouchers.deletedOn),
            lt(tVouchers.voucherDate, fromDate)
          )
        );

      let prevDebitSum = 0;
      let prevCreditSum = 0;
      prevEntries.forEach((e) => {
        if (e.entryType === "debit") prevDebitSum += Number(e.amount);
        else prevCreditSum += Number(e.amount);
      });
      openingBalance = prevDebitSum - prevCreditSum;

      // 3.2 Fetch Entries in the date range
      const entriesInRange = await db
        .select({
          entryId: tVoucherEntries.voucherEntryId,
          voucherId: tVoucherEntries.voucherId,
          entryType: tVoucherEntries.entryType,
          amount: tVoucherEntries.amount,
          voucherNo: tVouchers.voucherNo,
          voucherType: tVouchers.voucherType,
          voucherDate: tVouchers.voucherDate,
        })
        .from(tVoucherEntries)
        .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
        .where(
          and(
            eq(tVoucherEntries.ledgerId, ledgerId),
            isNull(tVouchers.deletedOn),
            gte(tVouchers.voucherDate, fromDate),
            lte(tVouchers.voucherDate, toDate)
          )
        )
        .orderBy(tVouchers.voucherDate, tVoucherEntries.voucherEntryId);

      // 3.3 For each entry, fetch all entries of the same voucher to resolve opposite ledger names
      const voucherIds = Array.from(new Set(entriesInRange.map((e) => e.voucherId)));
      let allVoucherPostings: any[] = [];
      if (voucherIds.length > 0) {
        allVoucherPostings = await db
          .select({
            voucherId: tVoucherEntries.voucherId,
            ledgerId: tVoucherEntries.ledgerId,
            ledgerName: mLedgers.ledgerName,
            entryType: tVoucherEntries.entryType,
          })
          .from(tVoucherEntries)
          .leftJoin(mLedgers, eq(tVoucherEntries.ledgerId, mLedgers.ledgerId))
          .where(inArray(tVoucherEntries.voucherId, voucherIds));
      }

      ledgerEntries = entriesInRange.map((e) => {
        // Find opposite ledger names in the same voucher
        const postingsInVoucher = allVoucherPostings.filter((p) => p.voucherId === e.voucherId);
        const opposites = postingsInVoucher.filter((p) => p.ledgerId !== ledgerId);
        let particularsName = "As per Details";
        if (opposites.length === 1) {
          particularsName = opposites[0].ledgerName;
        } else if (opposites.length > 1) {
          particularsName = opposites[0].ledgerName + " & others";
        } else {
          particularsName = selectedLedger.ledgerName;
        }

        return {
          entryId: e.entryId,
          voucherId: e.voucherId,
          voucherNo: e.voucherNo,
          voucherType: e.voucherType,
          voucherDate: e.voucherDate,
          entryType: e.entryType,
          amount: Number(e.amount),
          particulars: particularsName,
        };
      });

      // 3.4 If customer or vendor, also fetch pending invoice/payment vouchers for outstandings
      if (selectedLedger.referenceId) {
        vouchers = await db
          .select({
            voucherId: tVouchers.voucherId,
            voucherNo: tVouchers.voucherNo,
            voucherType: tVouchers.voucherType,
            voucherDate: tVouchers.voucherDate,
            partyId: tVouchers.partyId,
            netAmount: tVouchers.netAmount,
            billDetails: tVouchers.billDetails,
          })
          .from(tVouchers)
          .where(
            and(
              eq(tVouchers.companyId, companyId),
              eq(tVouchers.partyId, selectedLedger.referenceId),
              isNull(tVouchers.deletedOn),
              gte(tVouchers.voucherDate, fromDate),
              lte(tVouchers.voucherDate, toDate)
            )
          )
          .orderBy(tVouchers.voucherDate, tVouchers.voucherId);
      }
    }
  }

  // 4. Check permissions
  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ledger_report");
  const canExport = p?.e ?? false;

  return (
    <LedgerReportClient
      company={{
        companyId: company.companyId,
        companyName: company.companyName,
        gstNo: company.gstNo,
        address: company.address,
      }}
      ledgers={ledgers.map((l) => ({
        ledgerId: l.ledgerId,
        ledgerName: l.ledgerName,
        ledgerType: l.ledgerType,
        referenceId: l.referenceId ? Number(l.referenceId) : null,
        debit: Number(l.debit),
        credit: Number(l.credit),
        activityCount: Number(l.activityCount),
        lastPosted: l.lastPosted,
      }))}
      selectedLedger={selectedLedger}
      vouchers={vouchers}
      ledgerEntries={ledgerEntries}
      openingBalance={openingBalance}
      canExport={canExport}
    />
  );
}

