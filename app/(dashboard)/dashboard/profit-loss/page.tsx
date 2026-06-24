import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { tVouchers } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import ExportButton from "@/components/ExportButton";
import { getStaticPermissionsForRole, type Role } from "@/lib/permissions";

export default async function ProfitLossPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const totals = await db
    .select({
      sales: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'sale' then ${tVouchers.totalAmount} else 0 end), 0)`,
      purchase: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'purchase' then ${tVouchers.totalAmount} else 0 end), 0)`,
      payments: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'payment' then ${tVouchers.totalAmount} else 0 end), 0)`,
      receipts: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'receipt' then ${tVouchers.totalAmount} else 0 end), 0)`,
    })
    .from(tVouchers)
    .where(and(eq(tVouchers.companyId, companyId), isNull(tVouchers.deletedOn)));

  const revenue = Number(totals[0]?.sales ?? 0);
  const costOfGoods = Number(totals[0]?.purchase ?? 0);
  const expenses = Number(totals[0]?.payments ?? 0);
  const otherIncome = Number(totals[0]?.receipts ?? 0);
  const grossProfit = revenue - costOfGoods;
  const netProfit = revenue - costOfGoods - expenses + otherIncome;

  const perms = getStaticPermissionsForRole(session.user.role as Role);
  const p = perms.find((x) => x.accessItem === "profit_loss");
  const canExport = p?.e ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profit & Loss</h1>
          <p className="text-sm text-muted-foreground">
            Review revenue, cost, and cash performance for your company.
          </p>
        </div>
        <ExportButton
          filename="profit_loss.csv"
          headers={["Metric", "Amount"]}
          keys={["label", "value"]}
          rows={[
            { label: "Sales Revenue", value: revenue },
            { label: "Purchase Cost", value: costOfGoods },
            { label: "Gross Profit", value: grossProfit },
            { label: "Payments / Expenses", value: expenses },
            { label: "Receipts / Other Income", value: otherIncome },
            { label: "Net Profit", value: netProfit }
          ]}
          canExport={canExport}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{revenue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">COGS</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{costOfGoods.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{expenses.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Net Profit</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{netProfit.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Sales Revenue", value: revenue },
              { label: "Purchase Cost", value: costOfGoods },
              { label: "Payments / Expenses", value: expenses },
              { label: "Receipts / Other Income", value: otherIncome },
            ].map((row) => (
              <tr key={row.label} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 text-foreground">{row.label}</td>
                <td className="px-4 py-3 text-right text-foreground">₹{row.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
