import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mTaxRates, tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export default async function GstReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const [taxRates, taxSummary] = await Promise.all([
    db.select().from(mTaxRates).where(isNull(mTaxRates.deletedOn)).orderBy(mTaxRates.taxPercent),
    db
      .select({
        voucherType: tVouchers.voucherType,
        taxAmount: sql<number>`coalesce(sum(${tVouchers.taxAmount}), 0)`,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyId), isNull(tVouchers.deletedOn)))
      .groupBy(tVouchers.voucherType),
  ]);

  const totalGst = taxSummary.reduce((sum, item) => sum + Number(item.taxAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">GST Reports</h1>
        <p className="text-sm text-muted-foreground">
          View GST collection and payment details by voucher type.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total GST Amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalGst.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">GST Rate Count</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{taxRates.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border/50 bg-muted/40 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Voucher GST Summary
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Voucher Type</th>
                <th className="text-right">GST</th>
              </tr>
            </thead>
            <tbody>
              {taxSummary.map((row) => (
                <tr key={row.voucherType} className="border-b border-border/50">
                  <td className="px-4 py-4 text-sm font-medium text-foreground">{row.voucherType}</td>
                  <td className="px-4 py-4 text-right text-foreground">₹{Number(row.taxAmount ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {taxSummary.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No GST transactions found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border/50 bg-muted/40 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Defined GST Rates
          </div>
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Tax Name</th>
                <th className="text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((rate) => (
                <tr key={rate.taxRateId} className="border-b border-border/50">
                  <td className="px-4 py-4 text-sm font-medium text-foreground">{rate.taxName}</td>
                  <td className="px-4 py-4 text-right text-foreground">{Number(rate.taxPercent).toFixed(2)}%</td>
                </tr>
              ))}
              {taxRates.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No GST rates configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
