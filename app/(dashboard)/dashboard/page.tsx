import React from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { mInventory, mCompanies, mLedgers, tVouchers } from "@/lib/db/schema";
import { eq, sql, isNull, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";
import DashboardCharts from "@/components/DashboardCharts";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");

  // Owners without a company go to the admin dashboard
  if (session.user.role === "owner" && !session.user.companyId) {
    redirect("/dashboard/owner");
  }

  if (!session.user.companyId) redirect("/setup-company");

  const companyIdVal = Number(session.user.companyId);

  // Fetch Company Info
  const company = await db.query.mCompanies.findFirst({
    where: eq(mCompanies.companyId, companyIdVal),
  });

  if (!company) {
    redirect("/setup-company");
  }

  // Consolidated Database Queries in Parallel
  const [
    companiesCountRaw,
    inventoryCountRaw,
    ledgersCountRaw,
    monthlyStats,
    financialSummary,
    recentVouchers,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(mCompanies)
      .where(and(eq(mCompanies.parentCompanyId, companyIdVal), isNull(mCompanies.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mInventory)
      .where(and(eq(mInventory.companyId, companyIdVal), isNull(mInventory.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyIdVal), isNull(mLedgers.deletedOn))),
    db
      .select({
        month: sql<string>`to_char(${tVouchers.voucherDate}, 'Mon YYYY')`,
        sortKey: sql<string>`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`,
        sales: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'sale' then ${tVouchers.netAmount} else 0 end), 0)`,
        purchases: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'purchase' then ${tVouchers.netAmount} else 0 end), 0)`,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyIdVal), isNull(tVouchers.deletedOn)))
      .groupBy(sql`to_char(${tVouchers.voucherDate}, 'Mon YYYY')`, sql`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${tVouchers.voucherDate}, 'YYYY-MM')`)
      .limit(6),
    db
      .select({
        totalSales: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'sale' then ${tVouchers.netAmount} else 0 end), 0)`,
        totalPurchases: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'purchase' then ${tVouchers.netAmount} else 0 end), 0)`,
        totalReceipts: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'receipt' then ${tVouchers.netAmount} else 0 end), 0)`,
        totalPayments: sql<number>`coalesce(sum(case when ${tVouchers.voucherType} = 'payment' then ${tVouchers.netAmount} else 0 end), 0)`,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyIdVal), isNull(tVouchers.deletedOn))),
    db
      .select({
        voucherId: tVouchers.voucherId,
        voucherNo: tVouchers.voucherNo,
        voucherDate: tVouchers.voucherDate,
        voucherType: tVouchers.voucherType,
        netAmount: tVouchers.netAmount,
      })
      .from(tVouchers)
      .where(and(eq(tVouchers.companyId, companyIdVal), isNull(tVouchers.deletedOn)))
      .orderBy(desc(tVouchers.voucherDate), desc(tVouchers.voucherId))
      .limit(5),
  ]);

  const summary = financialSummary[0] || {
    totalSales: 0,
    totalPurchases: 0,
    totalReceipts: 0,
    totalPayments: 0,
  };

  const chartData = monthlyStats.map((s) => ({
    month: s.month || "Unknown",
    sales: Number(s.sales || 0),
    purchases: Number(s.purchases || 0),
  }));

  const partiesCount = companiesCountRaw[0]?.count ?? 0;
  const inventoryCount = inventoryCountRaw[0]?.count ?? 0;
  const ledgersCount = ledgersCountRaw[0]?.count ?? 0;

  const stats = [
    {
      name: "PARTIES",
      value: partiesCount,
      icon: "Building",
      color: "text-primary bg-primary/10",
      description: "Active business parties",
    },
    {
      name: "INVENTORY",
      value: inventoryCount,
      icon: "Package",
      color: "text-warning bg-warning/10",
      description: "Inventory stock items",
    },
    {
      name: "LEDGERS",
      value: ledgersCount,
      icon: "BookOpen",
      color: "text-info bg-info/10",
      description: "Chart of Accounts ledgers",
    },
  ];

  // Helper for rendering icons dynamically
  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className={className} size={22} />;
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground">
          WELCOME BACK, {session.user.name?.toUpperCase()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Managing bookkeeping and inventory for{" "}
          <span className="font-semibold text-foreground">
            {company.companyName}
          </span>
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/50 pt-4 sm:grid-cols-3 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">GSTIN</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block">
              {company.gstNo || "Not Configured"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">PAN</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block">
              {company.panNo || "Not Configured"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">ADDRESS</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block truncate">
              {company.address || "Not Configured"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/75">
                  {stat.name}
                </span>
                <span className="mt-1 block text-2xl font-bold text-foreground font-mono">
                  {stat.value}
                </span>
              </div>
              <div className={`rounded-lg p-2.5 ${stat.color}`}>
                {renderIcon(stat.icon, "h-5 w-5")}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground truncate">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Charts */}
      <DashboardCharts data={chartData} />

      {/* Main Grid: Recent Activity & Financial Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity Table */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">
            RECENT TRANSACTIONS
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Voucher No</th>
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {recentVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No recent transactions found.
                    </td>
                  </tr>
                ) : (
                  recentVouchers.map((v) => {
                    let badgeClass = "bg-primary/10 text-primary";
                    if (v.voucherType === "sale") badgeClass = "bg-success/15 text-success font-semibold";
                    else if (v.voucherType === "purchase") badgeClass = "bg-info/15 text-info font-semibold";
                    else if (v.voucherType === "receipt") badgeClass = "bg-warning/15 text-warning font-semibold";
                    else if (v.voucherType === "payment") badgeClass = "bg-danger/15 text-danger font-semibold";

                    return (
                      <tr key={v.voucherId} className="hover:bg-muted/5 transition-colors">
                        <td className="py-2.5 text-muted-foreground font-mono">
                          {v.voucherDate
                            ? new Date(v.voucherDate).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="py-2.5 text-foreground font-mono">{v.voucherNo}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${badgeClass}`}>
                            {v.voucherType}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-foreground">
                          ₹ {Number(v.netAmount).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Performance Summary */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">
            FINANCIAL PERFORMANCE
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase">Total Sales</p>
                <p className="text-base font-bold text-foreground font-mono tabular-nums">
                  ₹ {Number(summary.totalSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-success/10 p-2 text-success">
                <Icons.ArrowUpRight className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase">Total Purchases</p>
                <p className="text-base font-bold text-foreground font-mono tabular-nums">
                  ₹ {Number(summary.totalPurchases || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-info/10 p-2 text-info">
                <Icons.ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase">Total Receipts</p>
                <p className="text-base font-bold text-foreground font-mono tabular-nums">
                  ₹ {Number(summary.totalReceipts || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-warning/10 p-2 text-warning">
                <Icons.Plus className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/30 pb-2">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase">Total Payments</p>
                <p className="text-base font-bold text-foreground font-mono tabular-nums">
                  ₹ {Number(summary.totalPayments || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-danger/10 p-2 text-danger">
                <Icons.Minus className="h-4 w-4" />
              </div>
            </div>

            {/* Net Book Position */}
            <div className="rounded-lg border border-border/50 bg-muted/15 p-3 flex justify-between items-center mt-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Net Book Position</p>
                <p className="text-sm font-extrabold text-foreground font-mono tabular-nums mt-0.5">
                  ₹ {Number((summary.totalSales || 0) - (summary.totalPurchases || 0)).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  (summary.totalSales || 0) - (summary.totalPurchases || 0) >= 0
                    ? "bg-success/15 text-success"
                    : "bg-danger/15 text-danger"
                }`}
              >
                {(summary.totalSales || 0) - (summary.totalPurchases || 0) >= 0 ? "Surplus" : "Deficit"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
