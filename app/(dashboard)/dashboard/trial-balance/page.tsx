import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mLedgers, tVoucherEntries } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export default async function TrialBalancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const trialRows = await db
    .select({
      ledgerId: mLedgers.ledgerId,
      ledgerName: mLedgers.ledgerName,
      ledgerType: mLedgers.ledgerType,
      debit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'debit' then ${tVoucherEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${tVoucherEntries.entryType} = 'credit' then ${tVoucherEntries.amount} else 0 end), 0)`,
    })
    .from(mLedgers)
    .leftJoin(tVoucherEntries, eq(mLedgers.ledgerId, tVoucherEntries.ledgerId))
    .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn)))
    .groupBy(mLedgers.ledgerId, mLedgers.ledgerName, mLedgers.ledgerType)
    .orderBy(mLedgers.ledgerName);

  const totalDebit = trialRows.reduce((sum, row) => sum + Number(row.debit ?? 0), 0);
  const totalCredit = trialRows.reduce((sum, row) => sum + Number(row.credit ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Trial Balance</h1>
        <p className="text-sm text-muted-foreground">
          Verify that debit and credit totals remain in balance across your chart of accounts.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Ledger</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {trialRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No ledger postings have been recorded.
                </td>
              </tr>
            ) : (
              trialRows.map((row) => {
                const balance = Number(row.debit ?? 0) - Number(row.credit ?? 0);
                return (
                  <tr key={row.ledgerId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{row.ledgerName}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">{row.ledgerType}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(row.debit ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(row.credit ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">₹{balance.toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {trialRows.length > 0 && (
            <tfoot className="bg-muted/10 text-sm font-semibold text-foreground">
              <tr>
                <td colSpan={2} className="px-4 py-3">Totals</td>
                <td className="px-4 py-3 text-right">₹{totalDebit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{totalCredit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">₹{(totalDebit - totalCredit).toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
