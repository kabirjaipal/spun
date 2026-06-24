import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, tVoucherEntries, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import ExportButton from "@/components/ExportButton";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";

export default async function LedgerReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const ledgers = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      debit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      activityCount: sql<number>`count(${tVoucherEntries.voucherEntryId})`,
      lastPosted: sql<Date>`max(${tVouchers.voucherDate})`,
    })
    .from(mLedgers)
    .leftJoin(tVoucherEntries, eq(mLedgers.ledgerId, tVoucherEntries.ledgerId))
    .leftJoin(tVouchers, eq(tVoucherEntries.voucherId, tVouchers.voucherId))
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType)
    .orderBy(mLedgers.ledgerName);

  const totalDebit = ledgers.reduce((sum, ledger) => sum + Number(ledger.debit ?? 0), 0);
  const totalCredit = ledgers.reduce((sum, ledger) => sum + Number(ledger.credit ?? 0), 0);

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "ledger_report");
  const canExport = p?.e ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ledger Report</h1>
          <p className="text-sm text-muted-foreground">
            View ledger balances, posting frequency, and recent activity.
          </p>
        </div>
        <ExportButton
          filename="ledger_report.csv"
          headers={["Ledger Name", "Type", "Debit", "Credit", "Entries", "Last Posted"]}
          keys={["ledgerName", "ledgerType", "debit", "credit", "activityCount", "lastPostedDate"]}
          rows={ledgers.map(l => ({
            ...l,
            lastPostedDate: l.lastPosted ? l.lastPosted.toISOString().slice(0, 10) : "—"
          }))}
          canExport={canExport}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Ledger</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Entries</th>
              <th className="px-4 py-3 text-right">Last Posted</th>
            </tr>
          </thead>
          <tbody>
            {ledgers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No ledger data available yet.
                </td>
              </tr>
            ) : (
              ledgers.map((ledger) => (
                <tr key={ledger.ledgerId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{ledger.ledgerName}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">{ledger.ledgerType}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(ledger.debit ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(ledger.credit ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{ledger.activityCount}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {ledger.lastPosted ? ledger.lastPosted.toISOString().slice(0, 10) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {ledgers.length > 0 && (
            <tfoot className="bg-muted/10 text-sm font-semibold text-foreground">
              <tr>
                <td colSpan={2} className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right">₹{totalDebit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{totalCredit.toFixed(2)}</td>
                <td colSpan={2} className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
