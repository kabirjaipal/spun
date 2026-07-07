"use client";

import React, { useState, Suspense } from "react";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface RatioData {
  capitalAccount: number;
  loansLiability: number;
  currentLiabilities: number;
  currentAssets: number;
  cashInHand: number;
  bankAccounts: number;
  bankOD: number;
  sundryDebtors: number;
  sundryCreditors: number;
  salesAccounts: number;
  purchaseAccounts: number;
  closingStock: number;
  netProfit: number;
  grossProfit: number;
  indirectExpenses: number;
  directExpenses: number;
  openingStock: number;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface RatioAnalysisClientProps {
  company: Company;
  data: RatioData;
  canExport: boolean;
}

function RatioAnalysisContent({
  company,
  data,
  canExport,
}: RatioAnalysisClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Period state from URL or defaults
  const fyStartYear = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return m >= 3 ? y : y - 1;
  })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // Helper: Format to Indian Currency (en-IN)
  const formatAmount = (val: number) => {
    const abs = Math.abs(val);
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  };

  const formatBalance = (val: number, defaultDr = true) => {
    if (Math.abs(val) < 0.01) return "0.00";
    const absStr = formatAmount(val);
    const sign = val > 0 ? (defaultDr ? "Dr" : "Cr") : (defaultDr ? "Cr" : "Dr");
    return `${absStr} ${sign}`;
  };

  // Helper: Format date to d-MMM-yy (Tally style, e.g. 1-Apr-25)
  const formatDateToTally = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Calculations
  const workingCapital = data.currentAssets - data.currentLiabilities;

  // Working Capital Turnover = Sales Accounts / Working Capital
  const workingCapitalTurnover = workingCapital !== 0 
    ? (data.salesAccounts / workingCapital).toFixed(2) 
    : "0.00";

  // Inventory Turnover = Sales Accounts / Closing Stock
  const inventoryTurnover = data.closingStock !== 0 
    ? (data.salesAccounts / data.closingStock).toFixed(2) 
    : "0.00";

  // Current Ratio = Current Assets : Current Liabilities
  const currentRatio = data.currentLiabilities !== 0 
    ? (data.currentAssets / data.currentLiabilities).toFixed(2) 
    : "0.00";

  // Quick Ratio = (Current Assets - Closing Stock) : Current Liabilities
  const quickRatio = data.currentLiabilities !== 0 
    ? ((data.currentAssets - data.closingStock) / data.currentLiabilities).toFixed(2) 
    : "0.00";

  // Debt/Equity = Loans Liability : (Capital Account + Net Profit)
  const equity = data.capitalAccount + data.netProfit;
  const debtEquityRatio = equity !== 0 
    ? (data.loansLiability / equity).toFixed(2) 
    : "0.00";

  // GP % = Gross Profit / Sales Accounts
  const grossProfitPct = data.salesAccounts !== 0 
    ? ((data.grossProfit / data.salesAccounts) * 100).toFixed(2) 
    : "0.00";

  // NP % = Net Profit / Sales Accounts
  const netProfitPct = data.salesAccounts !== 0 
    ? ((data.netProfit / data.salesAccounts) * 100).toFixed(2) 
    : "0.00";

  // Operating Cost = COGS + Indirect Expenses
  // COGS = Opening Stock + Purchase Accounts + Direct Expenses - Closing Stock
  const cogs = data.openingStock + data.purchaseAccounts + data.directExpenses - data.closingStock;
  const operatingCost = cogs + data.indirectExpenses;
  const operatingCostPct = data.salesAccounts !== 0 
    ? ((operatingCost / data.salesAccounts) * 100).toFixed(2) 
    : "0.00";

  // Recv. Turnover in days = (Sundry Debtors / Sales Accounts) * 365
  const recvTurnover = data.salesAccounts !== 0 
    ? ((data.sundryDebtors / data.salesAccounts) * 365).toFixed(2) 
    : "0.00";

  // Return on Investment = Net Profit / (Capital Account + Net Profit)
  const roi = equity !== 0 
    ? ((data.netProfit / equity) * 100).toFixed(2) 
    : "0.00";

  // Return on Working Capital = Net Profit / Working Capital
  const rowc = workingCapital !== 0 
    ? ((data.netProfit / workingCapital) * 100).toFixed(2) 
    : "0.00";

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print settings to omit browser-supplied header/footer content and handle margins */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 0mm;
          }
          body {
            margin: 0mm !important;
          }
          .print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            padding: 1.5rem !important;
            box-sizing: border-box !important;
            background: white !important;
            color: black !important;
          }
        }
      `}} />

      {/* Screen Controls Header (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Ratio Analysis</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Button */}
          <Button
            variant="outline"
            onClick={() => setShowPeriodModal(true)}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          {/* Print PDF Button */}
          {canExport && (
            <Button onClick={triggerPrint} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Save as PDF
            </Button>
          )}
        </div>
      </div>

      {/* Main Report Dashboard Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Title Block */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Ratio Analysis
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {formatDateToTally(fromParam)} to {formatDateToTally(toParam)}
          </p>
        </div>

        {/* Dashboard split content */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left Column: Principal Groups */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              Principal Groups
            </h2>

            <div className="space-y-3 text-sm">
              {/* Working Capital */}
              <div className="flex justify-between items-start font-bold">
                <div>
                  <span>Working Capital</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Current Assets - Current Liabilities)
                  </div>
                </div>
                <span className="font-mono text-foreground">
                  {formatBalance(workingCapital, true)}
                </span>
              </div>

              {/* Cash-in-Hand */}
              <div className="flex justify-between items-center pl-4 text-foreground/90">
                <span>Cash-in-Hand</span>
                <span className="font-mono">
                  {formatBalance(data.cashInHand, true)}
                </span>
              </div>

              {/* Bank Accounts */}
              <div className="flex justify-between items-center pl-4 text-foreground/90">
                <span>Bank Accounts</span>
                <span className="font-mono">
                  {formatBalance(data.bankAccounts, true)}
                </span>
              </div>

              {/* Bank OD A/c */}
              {Math.abs(data.bankOD) > 0.01 && (
                <div className="flex justify-between items-center pl-4 text-foreground/90">
                  <span>Bank OD A/c</span>
                  <span className="font-mono">
                    {formatBalance(data.bankOD, false)}
                  </span>
                </div>
              )}

              {/* Sundry Debtors */}
              <div className="flex justify-between items-start pl-4 text-foreground/90">
                <div>
                  <span>Sundry Debtors</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (due till today)
                  </div>
                </div>
                <span className="font-mono">
                  {formatBalance(data.sundryDebtors, true)}
                </span>
              </div>

              {/* Sundry Creditors */}
              <div className="flex justify-between items-start pl-4 text-foreground/90 border-b border-border/40 pb-2">
                <div>
                  <span>Sundry Creditors</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (due till today)
                  </div>
                </div>
                <span className="font-mono">
                  {formatBalance(data.sundryCreditors, false)}
                </span>
              </div>

              {/* Sales Accounts */}
              <div className="flex justify-between items-center font-semibold">
                <span>Sales Accounts</span>
                <span className="font-mono">
                  {formatBalance(data.salesAccounts, false)}
                </span>
              </div>

              {/* Purchase Accounts */}
              <div className="flex justify-between items-center font-semibold">
                <span>Purchase Accounts</span>
                <span className="font-mono">
                  {formatBalance(data.purchaseAccounts, true)}
                </span>
              </div>

              {/* Stock-in-Hand */}
              <div className="flex justify-between items-center font-semibold">
                <span>Stock-in-Hand</span>
                <span className="font-mono">
                  {formatBalance(data.closingStock, true)}
                </span>
              </div>

              {/* Nett Profit/Loss */}
              <div className="flex justify-between items-center font-bold border-t border-border/60 pt-2 text-foreground">
                <span>{data.netProfit >= 0 ? "Nett Profit" : "Nett Loss"}</span>
                <span className="font-mono text-destructive">
                  {formatBalance(data.netProfit, data.netProfit < 0)}
                </span>
              </div>

              {/* Working Capital Turnover */}
              <div className="flex justify-between items-start font-semibold pt-4 border-t border-border/40">
                <div>
                  <span>Wkg. Capital Turnover</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Sales Accounts / Working Capital)
                  </div>
                </div>
                <span className="font-mono">{workingCapitalTurnover}</span>
              </div>

              {/* Inventory Turnover */}
              <div className="flex justify-between items-start font-semibold">
                <div>
                  <span>Inventory Turnover</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Sales Accounts / Closing Stock)
                  </div>
                </div>
                <span className="font-mono">{inventoryTurnover}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Principal Ratios */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              Principal Ratios
            </h2>

            <div className="space-y-4 text-sm font-semibold">
              {/* Current Ratio */}
              <div className="flex justify-between items-start">
                <div>
                  <span>Current Ratio</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Current Assets : Current Liabilities)
                  </div>
                </div>
                <span className="font-mono text-foreground text-base font-bold">
                  {currentRatio} : 1
                </span>
              </div>

              {/* Quick Ratio */}
              <div className="flex justify-between items-start">
                <div>
                  <span>Quick Ratio</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Current Assets - Stock-in-Hand : Current Liabilities)
                  </div>
                </div>
                <span className="font-mono text-foreground text-base font-bold">
                  {quickRatio} : 1
                </span>
              </div>

              {/* Debt/Equity Ratio */}
              <div className="flex justify-between items-start border-b border-border/40 pb-3">
                <div>
                  <span>Debt/Equity Ratio</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Loans (Liability) : Capital Account + Nett Profit)
                  </div>
                </div>
                <span className="font-mono text-foreground text-base font-bold">
                  {debtEquityRatio} : 1
                </span>
              </div>

              {/* Gross Profit % */}
              <div className="flex justify-between items-center text-foreground/90">
                <span>Gross Profit %</span>
                <span className="font-mono text-base font-bold">
                  {Number(grossProfitPct) < 0 ? `(-) ${Math.abs(Number(grossProfitPct))}%` : `${grossProfitPct}%`}
                </span>
              </div>

              {/* Nett Profit % */}
              <div className="flex justify-between items-center text-foreground/90">
                <span>Nett Profit %</span>
                <span className="font-mono text-base font-bold">
                  {Number(netProfitPct) < 0 ? `(-) ${Math.abs(Number(netProfitPct))}%` : `${netProfitPct}%`}
                </span>
              </div>

              {/* Operating Cost % */}
              <div className="flex justify-between items-start text-foreground/90">
                <div>
                  <span>Operating Cost %</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (as percentage of Sales Accounts)
                  </div>
                </div>
                <span className="font-mono text-base font-bold">
                  {operatingCostPct}%
                </span>
              </div>

              {/* Recv. Turnover in days */}
              <div className="flex justify-between items-start text-foreground/90">
                <div>
                  <span>Recv. Turnover in days</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (payment performance of Debtors)
                  </div>
                </div>
                <span className="font-mono text-base font-bold">
                  {recvTurnover} days
                </span>
              </div>

              {/* Return on Investment % */}
              <div className="flex justify-between items-start text-foreground/90">
                <div>
                  <span>Return on Investment %</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Nett Profit / Capital Account + Nett Profit) %
                  </div>
                </div>
                <span className="font-mono text-base font-bold">
                  {Number(roi) < 0 ? `(-) ${Math.abs(Number(roi))}%` : `${roi}%`}
                </span>
              </div>

              {/* Return on Wkg. Capital % */}
              <div className="flex justify-between items-start text-foreground/90">
                <div>
                  <span>Return on Wkg. Capital %</span>
                  <div className="text-xs font-normal text-muted-foreground italic">
                    (Nett Profit / Working Capital) %
                  </div>
                </div>
                <span className="font-mono text-base font-bold text-destructive">
                  {Number(rowc) < 0 ? `(-) ${Math.abs(Number(rowc))}%` : `${rowc}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Period Dialog Modal (Hidden on print) */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                From Date
              </Label>
              <Input
                id="from"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="col-span-3 h-10 text-sm bg-background border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                To Date
              </Label>
              <Input
                id="to"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="col-span-3 h-10 text-sm bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApplyPeriod} className="h-10 text-sm">
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RatioAnalysisClient(props: RatioAnalysisClientProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Ratio Analysis...</div>}>
      <RatioAnalysisContent {...props} />
    </Suspense>
  );
}
