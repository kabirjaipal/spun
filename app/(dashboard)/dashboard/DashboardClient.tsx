"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from "recharts";

interface Company {
  companyId: number;
  companyName: string;
  gstNo: string;
  address: string;
}

interface LedgerData {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  groupName: string;
  creditDays: number;
  debitCumulative: number;
  creditCumulative: number;
  debitPeriod: number;
  creditPeriod: number;
}

interface MonthlyStat {
  month: string;
  sortKey: string;
  sales: number;
  purchases: number;
}

interface VoucherData {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  netAmount: number;
  partyId: number | null;
  billDetails: any;
}

interface PartyData {
  companyId: number;
  dueDay: number;
}

interface DashboardClientProps {
  company: Company;
  fromDate: string;
  toDate: string;
  ledgers: LedgerData[];
  monthlyStats: MonthlyStat[];
  vouchers: VoucherData[];
  parties: PartyData[];
  openingStock: number;
  closingStock: number;
  closingStockQty: number;
  outwardsQty: number;
  outwardsValue: number;
}

export default function DashboardClient({
  company,
  fromDate,
  toDate,
  ledgers,
  monthlyStats,
  vouchers,
  parties,
  openingStock,
  closingStock,
  closingStockQty,
  outwardsQty,
  outwardsValue,
}: DashboardClientProps) {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Date Calculations for Current Quarter & Current Year
  // ---------------------------------------------------------------------------
  const today = new Date();
  
  const formatYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Current Quarter (Calendar-based)
  const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
  const qStart = new Date(today.getFullYear(), qStartMonth, 1);
  const qEnd = new Date(today.getFullYear(), qStartMonth + 3, 0);
  const quarterFrom = formatYYYYMMDD(qStart);
  const quarterTo = formatYYYYMMDD(qEnd);

  // Current Year (Financial Year starting April 1st)
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const yearFrom = `${fyStartYear}-04-01`;
  const yearTo = `${fyStartYear + 1}-03-31`;

  const isCurrentQuarter = fromDate === quarterFrom && toDate === quarterTo;
  const isCurrentYear = fromDate === yearFrom && toDate === yearTo;

  // Helper: Format amount to Indian Currency format with Dr/Cr
  const formatBalance = (val: number, showCrDr = true) => {
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);

    if (!showCrDr) return formatted;
    return val >= 0 ? `${formatted} Dr` : `${formatted} Cr`;
  };

  // Format date for Tally Prime style header display
  const formatDateRange = (from: string, to: string) => {
    const fmt = (dStr: string) => {
      const d = new Date(dStr);
      return `${d.getDate()}-${d.toLocaleDateString("en-US", { month: "short" })}-${String(d.getFullYear()).slice(-2)}`;
    };
    return `${fmt(from)} to ${fmt(to)}`;
  };

  // ---------------------------------------------------------------------------
  // 1. Line Trend Charts Calculations
  // ---------------------------------------------------------------------------
  const fyStartYearNum = new Date(fromDate).getFullYear();
  const monthsList = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = (3 + i) % 12; // April is index 3
    const yearOffset = (3 + i) >= 12 ? 1 : 0;
    const year = fyStartYearNum + yearOffset;
    const dateObj = new Date(year, monthIndex, 1);
    const monthLabel = dateObj.toLocaleDateString("en-US", { month: "short" }) + "-" + String(year).slice(-2);
    const monthKey = String(year) + "-" + String(monthIndex + 1).padStart(2, "0");
    monthsList.push({ label: monthLabel, sortKey: monthKey });
  }

  const salesTrend = monthsList.map((m) => {
    const stat = monthlyStats.find((s) => s.sortKey === m.sortKey);
    return {
      month: m.label,
      val: stat ? stat.sales : 0,
    };
  });

  const purchaseTrend = monthsList.map((m) => {
    const stat = monthlyStats.find((s) => s.sortKey === m.sortKey);
    return {
      month: m.label,
      val: stat ? stat.purchases : 0,
    };
  });

  // SVG Line Chart Renderer Component using shadcn and Recharts
  const LineChart = ({ data, color, type }: { data: { month: string; val: number }[]; color: string; type: "sales" | "purchases" }) => {
    const chartData = data.map((d) => ({
      month: d.month,
      netTransactions: d.val,
    }));

    const chartConfig = {
      netTransactions: {
        label: type === "sales" ? "Sales" : "Purchases",
        color: type === "sales" ? "hsl(var(--primary))" : "hsl(var(--warning))",
      },
    } satisfies ChartConfig;

    return (
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <RechartsLineChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 12,
            right: 12,
            top: 10,
            bottom: 5,
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.split("-")[0]}
            className="text-[9px]"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              if (value >= 100000) return `${(value / 100000).toFixed(0)}L`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
              return String(value);
            }}
            className="text-[9px]"
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value) => `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${type === "sales" ? "Cr" : "Dr"}`}
              />
            }
          />
          <Line
            dataKey="netTransactions"
            type="monotone"
            stroke={type === "sales" ? "hsl(var(--primary))" : "hsl(var(--warning))"}
            strokeWidth={2}
            dot={{
              r: 3,
              fill: type === "sales" ? "hsl(var(--primary))" : "hsl(var(--warning))",
            }}
            activeDot={{
              r: 5,
              fill: type === "sales" ? "hsl(var(--primary))" : "hsl(var(--warning))",
            }}
          />
        </RechartsLineChart>
      </ChartContainer>
    );
  };

  // ---------------------------------------------------------------------------
  // 2. Cash In/Out Flow Calculations
  // ---------------------------------------------------------------------------
  const cashBankLedgers = ledgers.filter(
    (l) =>
      l.ledgerType === "cash" ||
      l.ledgerType === "bank" ||
      (l.groupName || "").toLowerCase().includes("cash") ||
      (l.groupName || "").toLowerCase().includes("bank")
  );

  const inflow = cashBankLedgers.reduce((sum, l) => sum + l.debitPeriod, 0);
  const outflow = cashBankLedgers.reduce((sum, l) => sum + l.creditPeriod, 0);
  const nettFlow = inflow - outflow;

  // ---------------------------------------------------------------------------
  // 3. Receivables & Payables Calculations
  // ---------------------------------------------------------------------------
  const paidAmounts: Record<number, number> = {};
  vouchers.forEach((v) => {
    if (v.voucherType !== "sale" && v.voucherType !== "purchase") {
      if (v.billDetails && Array.isArray(v.billDetails)) {
        v.billDetails.forEach((item: any) => {
          if (item && typeof item === "object" && "voucherId" in item) {
            const vId = Number(item.voucherId);
            const amt = Number(item.amount) || 0;
            paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
          }
        });
      }
    }
  });

  let totalReceivables = 0;
  let overdueReceivables = 0;
  let totalPayables = 0;
  let overduePayables = 0;

  const toDateObj = new Date(toDate);

  vouchers.forEach((v) => {
    if (v.voucherType === "sale" || v.voucherType === "purchase") {
      const net = v.netAmount;
      const paid = paidAmounts[v.voucherId] || 0;
      const outstanding = net - paid;

      if (outstanding > 0.01) {
        const pId = v.partyId;
        const partyObj = parties.find((p) => p.companyId === pId);
        const dueDay = partyObj ? partyObj.dueDay : 10;

        const invDate = new Date(v.voucherDate);
        const diffTime = toDateObj.getTime() - invDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (v.voucherType === "sale") {
          totalReceivables += outstanding;
          if (diffDays > dueDay) {
            overdueReceivables += outstanding;
          }
        } else {
          totalPayables += outstanding;
          if (diffDays > dueDay) {
            overduePayables += outstanding;
          }
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Trading & Profit & Loss Calculations
  // ---------------------------------------------------------------------------
  let salesTotal = 0;
  let purchaseTotal = 0;
  let directExpenses = 0;
  let directIncomes = 0;
  let indirectExpenses = 0;
  let indirectIncomes = 0;

  ledgers.forEach((l) => {
    const netPeriod = l.debitPeriod - l.creditPeriod;
    const type = l.ledgerType.toLowerCase();
    const gName = (l.groupName || "").toLowerCase();

    if (type === "sales") {
      salesTotal += -netPeriod; // sales is credit normal
    } else if (type === "purchase") {
      purchaseTotal += netPeriod; // purchase is debit normal
    } else if (type === "expense") {
      const isDirect = gName.includes("direct") || gName.includes("trading") || gName.includes("manufacturing");
      if (isDirect) directExpenses += netPeriod;
      else indirectExpenses += netPeriod;
    } else if (type === "income") {
      const isDirect = gName.includes("direct") || gName.includes("trading") || gName.includes("revenue");
      if (isDirect) directIncomes += -netPeriod;
      else indirectIncomes += -netPeriod;
    }
  });

  const drSide1 = openingStock + purchaseTotal + directExpenses;
  const crSide1 = salesTotal + closingStock + directIncomes;
  const grossProfit = crSide1 - drSide1;

  const grossLossBF = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const grossProfitBF = grossProfit > 0 ? grossProfit : 0;

  const drSide2 = grossLossBF + indirectExpenses;
  const crSide2 = grossProfitBF + indirectIncomes;
  const netProfit = crSide2 - drSide2;

  const netLoss = netProfit < 0 ? Math.abs(netProfit) : 0;
  const netProfitVal = netProfit > 0 ? netProfit : 0;

  // ---------------------------------------------------------------------------
  // 5. Assets & Liabilities Category Rollup (Closing Balances)
  // ---------------------------------------------------------------------------
  const getTopCategory = (groupId: number | null, ledgerType: string, groupName: string): string => {
    const name = (groupName || "").toLowerCase();
    const type = (ledgerType || "").toLowerCase();

    if (type === "capital" || name.includes("capital")) return "Capital Account";
    if (type === "loan" || name.includes("loan") || name.includes("secured") || name.includes("unsecured")) return "Loans (Liability)";
    if (type === "tax" || name.includes("tax") || name.includes("provision") || name.includes("creditor") || name.includes("liability")) return "Current Liabilities";
    if (type === "cash" || type === "bank" || name.includes("debtor") || name.includes("bank") || name.includes("cash") || name.includes("stock") || name.includes("asset")) return "Current Assets";
    if (name.includes("fixed asset")) return "Fixed Assets";
    if (name.includes("investment")) return "Investments";

    if (type === "company") return "Current Liabilities"; // defaults creditors
    if (type === "customer") return "Current Assets"; // defaults debtors

    return "Current Assets";
  };

  let currentAssets = 0;
  let currentLiabilities = 0;
  let capitalAccount = 0;
  let loansLiability = 0;

  ledgers.forEach((l) => {
    const bal = l.debitCumulative - l.creditCumulative;
    const cat = getTopCategory(l.groupId, l.ledgerType, l.groupName);

    if (cat === "Current Assets") {
      currentAssets += bal;
    } else if (cat === "Current Liabilities") {
      currentLiabilities += -bal;
    } else if (cat === "Capital Account") {
      capitalAccount += -bal;
    } else if (cat === "Loans (Liability)") {
      loansLiability += -bal;
    }
  });

  currentAssets += closingStock;

  // ---------------------------------------------------------------------------
  // 6. Cash/Bank closing balances & Top Ledgers
  // ---------------------------------------------------------------------------
  let cashInHand = 0;
  let bankAccountsTotal = 0;
  const bankAccountsList: { name: string; bal: number }[] = [];

  ledgers.forEach((l) => {
    const bal = l.debitCumulative - l.creditCumulative;
    const type = l.ledgerType.toLowerCase();
    const gName = (l.groupName || "").toLowerCase();

    if (type === "cash" || gName.includes("cash in hand")) {
      cashInHand += bal;
    } else if (type === "bank" || gName.includes("bank account")) {
      bankAccountsTotal += bal;
      if (bal !== 0) {
        bankAccountsList.push({ name: l.ledgerName, bal });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Accounting Ratios calculations
  // ---------------------------------------------------------------------------
  const cogs = openingStock + purchaseTotal + directExpenses - closingStock;
  const avgStock = (openingStock + closingStock) / 2;
  const inventoryTurnover = avgStock > 0 ? cogs / avgStock : 0;

  const debt = loansLiability;
  const equity = capitalAccount + netProfit;
  const debtEquityRatio = equity !== 0 ? debt / equity : 0;

  const receivableTurnoverDays = salesTotal > 0 ? (totalReceivables / salesTotal) * 365 : 0;
  const roi = capitalAccount > 0 ? (netProfit / capitalAccount) * 100 : 0;

  return (
    <div className="text-foreground font-sans select-none space-y-6">
      
      {/* Tally Style Header Info Banner */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pb-4 border-b border-border/50">
        <div>
          <h2 className="text-xs uppercase font-extrabold text-primary tracking-wide">Dashboard</h2>
          <h1 className="text-lg font-black uppercase text-foreground leading-tight mt-0.5">
            {company.companyName}
          </h1>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Period Selector Tabs */}
          <div className="flex bg-muted/20 p-1 rounded-lg border border-border">
            <Button
              variant={isCurrentQuarter ? "secondary" : "ghost"}
              onClick={() => router.push(`?from=${quarterFrom}&to=${quarterTo}`)}
              className="font-bold uppercase tracking-wider px-4 text-xs h-9"
            >
              Current Quarter
            </Button>
            <Button
              variant={isCurrentYear ? "secondary" : "ghost"}
              onClick={() => router.push(`?from=${yearFrom}&to=${yearTo}`)}
              className="font-bold uppercase tracking-wider px-4 text-xs h-9"
            >
              Current Year
            </Button>
          </div>
          
          <div className="text-right">
            <span className="text-xs font-bold uppercase text-muted-foreground block">Period</span>
            <span className="text-sm font-extrabold text-foreground tracking-wide font-mono block mt-0.5">
              {formatDateRange(fromDate, toDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Grid - Balanced 3 Columns Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUMN 1 */}
        <div className="space-y-6">
          {/* Sales Trend Tile */}
          <div className="bg-muted/10 p-4 rounded-lg flex flex-col hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Sales Trend</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="py-2 flex items-center justify-center min-h-[190px]">
              <LineChart data={salesTrend} color="stroke-primary text-primary" type="sales" />
            </div>
          </div>

          {/* Trading Details Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Trading Details</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Amount</span>
              </div>
              {grossProfit < 0 ? (
                <div className="flex justify-between font-bold text-danger">
                  <span>Gross Loss</span>
                  <span>{formatBalance(grossLossBF)}</span>
                </div>
              ) : (
                <div className="flex justify-between font-bold text-success">
                  <span>Gross Profit</span>
                  <span>{formatBalance(grossProfitBF)}</span>
                </div>
              )}
              {netProfit < 0 ? (
                <div className="flex justify-between font-bold text-danger">
                  <span>Nett Loss</span>
                  <span>{formatBalance(netLoss)}</span>
                </div>
              ) : (
                <div className="flex justify-between font-bold text-success">
                  <span>Nett Profit</span>
                  <span>{formatBalance(netProfitVal)}</span>
                </div>
              )}
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Sales Accounts</span>
                <span>{formatBalance(-salesTotal)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Purchase Accounts</span>
                <span>{formatBalance(purchaseTotal)}</span>
              </div>
            </div>
          </div>

          {/* Cash/Bank Accounts Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Cash/Bank Accounts</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Closing Balance</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Cash-in-Hand</span>
                <span className={cashInHand < 0 ? "text-destructive" : ""}>{formatBalance(cashInHand)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Bank Accounts</span>
                <span className={bankAccountsTotal < 0 ? "text-destructive" : ""}>{formatBalance(bankAccountsTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2 */}
        <div className="space-y-6">
          {/* Purchase Trend Tile */}
          <div className="bg-muted/10 p-4 rounded-lg flex flex-col hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Purchase Trend</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="py-2 flex items-center justify-center min-h-[190px]">
              <LineChart data={purchaseTrend} color="stroke-warning text-warning" type="purchases" />
            </div>
          </div>

          {/* Assets/Liabilities Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Assets/Liabilities</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Closing Balance</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Current Assets</span>
                <span>{formatBalance(currentAssets)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Current Liabilities</span>
                <span>{formatBalance(-currentLiabilities)}</span>
              </div>
            </div>
          </div>

          {/* Inventory Details Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Inventory Details</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="text-center font-sans font-bold text-muted-foreground text-[10px] uppercase border-b border-border/30 pb-1">
                for Primary
              </div>
              <div className="grid grid-cols-3 text-muted-foreground font-sans text-[10px] uppercase border-b border-border/30 pb-1">
                <span>Particulars</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Value</span>
              </div>
              <div className="grid grid-cols-3 text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Closing Stock</span>
                <span className="text-right font-semibold">{closingStockQty.toLocaleString("en-IN")}</span>
                <span className="text-right">₹{formatBalance(closingStock, false)}</span>
              </div>
              <div className="grid grid-cols-3 text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Outwards</span>
                <span className="text-right font-semibold">{outwardsQty.toLocaleString("en-IN")}</span>
                <span className="text-right">₹{formatBalance(outwardsValue, false)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3 */}
        <div className="space-y-6">
          {/* Cash In/Out Flow Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Cash In/Out Flow</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="text-center font-sans font-bold text-muted-foreground text-[10px] uppercase border-b border-border/30 pb-1">
                for Primary
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between font-bold border-b border-border/30 pb-1.5">
                <span className="font-sans">Nett Flow</span>
                <span className={nettFlow < 0 ? "text-destructive" : "text-success"}>{formatBalance(nettFlow)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Inflow</span>
                <span>{formatBalance(inflow)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Outflow</span>
                <span>{formatBalance(-outflow)}</span>
              </div>
            </div>
          </div>

          {/* Receivables/Payables Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Receivables/Payables</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Pending Amount</span>
              </div>
              <div className="flex justify-between font-bold text-foreground/85">
                <span className="font-sans text-foreground/80">Receivables</span>
                <span>{formatBalance(totalReceivables, false)} Dr</span>
              </div>
              <div className="flex justify-between text-muted-foreground pl-3 text-[10px]">
                <span className="font-sans">Overdue Receivables</span>
                <span>{formatBalance(overdueReceivables, false)} Dr</span>
              </div>
              <div className="flex justify-between font-bold border-t border-border/30 pt-1.5 mt-1 text-foreground/85">
                <span className="font-sans text-foreground/80">Payables</span>
                <span>{formatBalance(-totalPayables, false)} Cr</span>
              </div>
              <div className="flex justify-between text-muted-foreground pl-3 text-[10px]">
                <span className="font-sans">Overdue Payables</span>
                <span>{formatBalance(-overduePayables, false)} Cr</span>
              </div>
            </div>
          </div>

          {/* Accounting Ratios Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Accounting Ratios</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Value</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Inventory Turnover</span>
                <span>{inventoryTurnover.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Debt/Equity Ratio</span>
                <span>{debtEquityRatio.toFixed(2)} : 1</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Receivable Turnover in Days</span>
                <span>{receivableTurnoverDays.toFixed(2)} days</span>
              </div>
              <div className="flex justify-between text-foreground/85">
                <span className="font-sans font-medium text-foreground/80">Return on Investment %</span>
                <span className={roi < 0 ? "text-destructive font-bold" : "text-success font-bold"}>
                  {roi < 0 ? "(-)" : ""}{Math.abs(roi).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Top Groups/Ledgers Tile */}
          <div className="bg-muted/10 p-4 rounded-lg hover:bg-muted/15 transition-all">
            <div className="border-b border-border/40 pb-2 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">Top Groups/Ledgers</h3>
              <span className="text-[9px] text-muted-foreground font-mono block mt-0.5">{formatDateRange(fromDate, toDate)}</span>
            </div>
            <div className="font-mono text-xs space-y-2.5">
              <div className="text-center font-sans font-bold text-muted-foreground text-[10px] uppercase border-b border-border/30 pb-1">
                for Bank Accounts (Ledger-wise)
              </div>
              <div className="flex justify-between items-center border-b border-border/30 pb-1 text-[10px] text-muted-foreground font-sans uppercase">
                <span>Particulars</span>
                <span>Closing Balance</span>
              </div>
              {bankAccountsList.length === 0 ? (
                <div className="text-center text-muted-foreground py-2 font-sans text-xs">No Bank Accounts Found</div>
              ) : (
                bankAccountsList.map((b) => (
                  <div key={b.name} className="flex justify-between text-foreground/85">
                    <span className="truncate max-w-[200px] font-sans font-medium text-foreground/80">{b.name}</span>
                    <span className={b.bal < 0 ? "text-destructive" : ""}>{formatBalance(b.bal)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
