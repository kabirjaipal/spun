"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface MonthlySummaryItem {
  monthKey: string;
  monthName: string;
  year: number;
  debit: number;
  credit: number;
  closingBalance: number;
}

interface Voucher {
  voucherId: number;
  voucherType: string;
  voucherDate: string;
  netAmount: string;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface PurchaseRegisterClientProps {
  company: Company;
  monthlySummary: MonthlySummaryItem[];
  vouchers: Voucher[];
  canExport: boolean;
}

function PurchaseRegisterContent({
  company,
  monthlySummary,
  vouchers,
  canExport,
}: PurchaseRegisterClientProps) {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const getDailySummary = (monthKey: string) => {
    const [year, monthNum] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const monthVouchers = vouchers.filter(
      (v) => v.voucherDate.slice(0, 7) === monthKey
    );

    // Calculate opening balance before this month
    const beforeVouchers = vouchers.filter(
      (v) => v.voucherDate < `${year}-${String(monthNum).padStart(2, "0")}-01`
    );
    const beforeDebit = beforeVouchers
      .filter((v) => v.voucherType === "purchase")
      .reduce((sum, v) => sum + Number(v.netAmount), 0);
    const beforeCredit = beforeVouchers
      .filter((v) => v.voucherType === "purchase_return")
      .reduce((sum, v) => sum + Number(v.netAmount), 0);
    let runningDailyBalance = beforeDebit - beforeCredit;

    const dailySummaryList = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayVouchers = monthVouchers.filter((v) => v.voucherDate === dateStr);

      const debit = dayVouchers
        .filter((v) => v.voucherType === "purchase")
        .reduce((sum, v) => sum + Number(v.netAmount), 0);

      const credit = dayVouchers
        .filter((v) => v.voucherType === "purchase_return")
        .reduce((sum, v) => sum + Number(v.netAmount), 0);

      runningDailyBalance += (debit - credit);

      dailySummaryList.push({
        date: dateStr,
        day,
        debit,
        credit,
        closingBalance: runningDailyBalance,
      });
    }

    return dailySummaryList;
  };

  // Omission lists
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // Helper: Format to Indian Currency (en-IN)
  const formatAmount = (val: number) => {
    if (Math.abs(val) < 0.01) return "—";
    const abs = Math.abs(val);
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
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

  const handleRemoveLine = (id: string) => {
    setRemovedLines((prev) => [...prev, id]);
    setLastRemovedLine(id);
  };

  const handleRestoreLine = () => {
    if (lastRemovedLine) {
      setRemovedLines((prev) => prev.filter((n) => n !== lastRemovedLine));
      setLastRemovedLine(null);
    } else if (removedLines.length > 0) {
      const copy = [...removedLines];
      const popped = copy.pop();
      setRemovedLines(copy);
      setLastRemovedLine(popped || null);
    }
  };

  // Search filtering
  const searchedSummary = monthlySummary.filter((item) =>
    item.monthName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Omission filtering
  const visibleSummary = searchedSummary.filter(
    (item) => !removedLines.includes(`${item.monthName} ${item.year}`)
  );

  // Calculate grand totals of transactions
  const totalDebitSum = visibleSummary.reduce((sum, item) => sum + item.debit, 0);
  const totalCreditSum = visibleSummary.reduce((sum, item) => sum + item.credit, 0);
  
  // Closing balance of the last visible month
  const finalClosingBalance = visibleSummary.length > 0 
    ? visibleSummary[visibleSummary.length - 1].closingBalance 
    : 0;

  const triggerPrint = () => {
    window.print();
  };

  // SVG Chart Dimensions
  const chartHeight = 160;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;
  const totalWidth = 600;
  const totalHeight = chartHeight + paddingTop + paddingBottom;
  const plotWidth = totalWidth - paddingLeft - paddingRight;

  const maxVal = Math.max(
    ...visibleSummary.map((d) => d.debit),
    1000 // default min threshold to avoid divide by zero
  );

  // Nice tick calculation
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const yMax = Math.ceil(maxVal / magnitude) * magnitude;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];
  const colWidth = visibleSummary.length > 0 ? plotWidth / visibleSummary.length : plotWidth;
  const barWidth = Math.min(22, colWidth * 0.35);

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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Purchase Register</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search month..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border h-10 text-sm"
            />
          </div>

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

      {/* Main Report Table Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Title Block */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Purchase Register
          </p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {formatDateToTally(fromParam)} to {formatDateToTally(toParam)}
          </p>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]" rowSpan={2}>
                  Particulars
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Transactions
                </th>
                <th className="p-3 text-right border-l border-border w-[200px]" rowSpan={2}>
                  Closing Balance
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-right border-l border-border w-[160px]">Debit</th>
                <th className="p-3 text-right border-l border-border w-[160px]">Credit</th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {visibleSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground italic">
                    No purchase data found for the selected period
                  </td>
                </tr>
              ) : (
                visibleSummary.map((item) => {
                  const label = `${item.monthName} ${item.year}`;
                  const balSign = item.closingBalance >= 0 ? "Dr" : "Cr";

                  return (
                    <React.Fragment key={item.monthKey}>
                      <tr
                        className="group/row hover:bg-muted/10 transition-colors font-medium cursor-pointer"
                        onClick={() => {
                          setExpandedMonth(expandedMonth === item.monthKey ? null : item.monthKey);
                        }}
                      >
                        {/* Particulars (Month Name) */}
                        <td className="p-3 pl-6 font-semibold text-foreground">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                                  expandedMonth === item.monthKey ? "rotate-90" : ""
                                }`}
                              />
                              <span>{item.monthName}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveLine(label);
                              }}
                              className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                            >
                              Omit
                            </button>
                          </div>
                        </td>

                        {/* Debit */}
                        <td className="p-3 text-right border-l border-border font-mono">
                          {formatAmount(item.debit)}
                        </td>

                        {/* Credit */}
                        <td className="p-3 text-right border-l border-border font-mono text-muted-foreground">
                          {formatAmount(item.credit)}
                        </td>

                        {/* Closing Balance */}
                        <td className="p-3 text-right border-l border-border font-mono font-bold text-foreground">
                          {formatAmount(item.closingBalance)} {balSign}
                        </td>
                      </tr>

                      {/* Daily Transactions sub-rows */}
                      {expandedMonth === item.monthKey && (
                        <tr>
                          <td colSpan={4} className="p-0 border-b border-border bg-muted/5">
                            <div className="p-4 pl-12 pr-6 space-y-2">
                              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                Daily Transactions Breakdown ({item.monthName})
                              </h4>
                              <table className="w-full text-xs border border-border/60 rounded overflow-hidden">
                                <thead>
                                  <tr className="bg-muted/30 border-b border-border/60 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                                    <th className="p-2 text-left">Date</th>
                                    <th className="p-2 text-right">Debit (Purchase)</th>
                                    <th className="p-2 text-right">Credit (Return)</th>
                                    <th className="p-2 text-right">Closing Balance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getDailySummary(item.monthKey).map((dayRow) => {
                                    const dayBalSign = dayRow.closingBalance >= 0 ? "Dr" : "Cr";
                                    return (
                                      <tr key={dayRow.date} className="border-b border-border/40 hover:bg-muted/10">
                                        <td className="p-2 font-mono">{formatDateToTally(dayRow.date)}</td>
                                        <td className="p-2 text-right font-mono">{formatAmount(dayRow.debit)}</td>
                                        <td className="p-2 text-right font-mono text-muted-foreground">{formatAmount(dayRow.credit)}</td>
                                        <td className="p-2 text-right font-mono font-bold">{formatAmount(dayRow.closingBalance)} {dayBalSign}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6">Grand Total</td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                  {formatAmount(totalDebitSum)}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-muted-foreground">
                  {formatAmount(totalCreditSum)}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                  {formatAmount(finalClosingBalance)} {finalClosingBalance >= 0 ? "Dr" : "Cr"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SVG Bar Chart at the Bottom (Matches the screenshot layout) */}
        {visibleSummary.length > 0 && (
          <div className="border-t border-border p-6 bg-muted/5 flex flex-col items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-4 self-start">
              Monthly Transactions Chart (Debit Purchases)
            </h3>
            <div className="relative w-full max-w-3xl h-[220px]">
              <svg
                viewBox={`0 0 ${totalWidth} ${totalHeight}`}
                className="w-full h-full text-muted-foreground font-mono"
              >
                {/* Grid Lines & Y Axis Labels */}
                {yTicks.map((tick, idx) => {
                  const y = paddingTop + chartHeight - (tick / yMax) * chartHeight;
                  return (
                    <g key={idx} className="opacity-30">
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={totalWidth - paddingRight}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="0.5"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-muted-foreground text-[10px]"
                      >
                        ₹{(tick >= 100000 ? `${(tick / 100000).toFixed(1)}L` : tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0))}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {visibleSummary.map((item, idx) => {
                  const xCenter = paddingLeft + idx * colWidth + colWidth / 2;
                  const barHeight = (item.debit / yMax) * chartHeight;
                  const barY = paddingTop + chartHeight - barHeight;
                  const barX = xCenter - barWidth / 2;

                  return (
                    <g key={idx}>
                      {/* Bar (Using deep red/crimson matching tally theme) */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={Math.max(2, barHeight)}
                        rx="2"
                        className="fill-destructive/80 transition-all duration-300 hover:brightness-110 cursor-pointer"
                      >
                        <title>{`${item.monthName}: ₹${formatAmount(item.debit)}`}</title>
                      </rect>

                      {/* Label */}
                      <text
                        x={xCenter}
                        y={paddingTop + chartHeight + 15}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[10px] font-semibold"
                      >
                        {item.monthName.slice(0, 3)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Omitted Rows Warning Alert (Hidden on print) */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> months from the purchase register.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 px-3" onClick={handleRestoreLine}>
              Restore Last
            </Button>
            <Button
              variant="outline"
              className="h-9 px-3 text-destructive border-destructive/25 hover:bg-destructive/10"
              onClick={() => {
                setRemovedLines([]);
                setLastRemovedLine(null);
              }}
            >
              Restore All
            </Button>
          </div>
        </div>
      )}

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

export default function PurchaseRegisterClient(props: PurchaseRegisterClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Purchase Register</span></div>}>
      <PurchaseRegisterContent {...props} />
    </Suspense>
  );
}
