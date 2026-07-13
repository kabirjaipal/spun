"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

interface MonthlySummaryItem {
  monthKey: string;
  monthName: string;
  year: number;
  openingWorkingCapital: number;
  closingWorkingCapital: number;
  fundsFlow: number;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface DetailedMonthItem {
  ledgerId: number;
  ledgerName: string;
  openingBalance: number;
  closingBalance: number;
  flow: number;
}

interface DetailedMonth {
  monthName: string;
  assets: DetailedMonthItem[];
  liabilities: DetailedMonthItem[];
  openingStock: number;
  closingStock: number;
}

interface FundsFlowClientProps {
  company: Company;
  monthlySummary: MonthlySummaryItem[];
  detailedMonth: DetailedMonth | null;
  canExport: boolean;
}

function FundsFlowContent({
  company,
  monthlySummary,
  detailedMonth,
  canExport,
}: FundsFlowClientProps) {
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

  const monthParam = searchParams.get("month");

  // Omission list
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
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);

    if (val < 0) {
      return `(-) ${formatted}`;
    }
    return formatted;
  };

  const handleRemoveLine = (name: string) => {
    setRemovedLines((prev) => [...prev, name]);
    setLastRemovedLine(name);
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

  // Filter out omitted months
  const activeSummary = monthlySummary.filter(
    (item) => !removedLines.includes(`${item.monthName} ${item.year}`)
  );

  // Grand Totals calculations
  const grandOpening = activeSummary.length > 0 ? activeSummary[0].openingWorkingCapital : 0;
  const grandClosing = activeSummary.length > 0 ? activeSummary[activeSummary.length - 1].closingWorkingCapital : 0;
  const grandFlow = grandClosing - grandOpening;

  // Recharts data format
  const chartData = activeSummary.map((item) => ({
    name: item.monthName.slice(0, 3), // e.g. "Apr"
    value: item.fundsFlow,
    originalLabel: `${item.monthName} ${item.year}`,
  }));

  // Tooltip custom component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-2 rounded shadow text-xs">
          <p className="font-semibold text-foreground">{data.originalLabel}</p>
          <p className="font-mono text-foreground">
            Funds Flow: <span className={data.value >= 0 ? "text-primary" : "text-destructive"}>
              {formatAmount(data.value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Minimal print styling to override layout margins and remove browser header/footer stamps */}
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

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground">Funds Flow</h1>
        </div>

        {/* Action Button Row */}
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

          {/* Export PDF Button */}
          {canExport && (
            <Button onClick={triggerPrint} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Save as PDF
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumb / Back button */}
      {monthParam && (
        <div className="flex items-center gap-2 mb-1 no-print">
          <Button
            variant="outline"
            className="h-9 px-3 text-sm font-semibold"
            onClick={() => {
              router.push(`?from=${fromParam}&to=${toParam}`);
            }}
          >
            ← Back
          </Button>
          <div className="text-xs text-muted-foreground font-medium">
            <span 
              className="hover:underline cursor-pointer text-foreground" 
              onClick={() => router.push(`?from=${fromParam}&to=${toParam}`)}
            >
              Funds Flow
            </span>
            {" / "}
            <span className="font-semibold text-foreground">
              {detailedMonth?.monthName || "Month"}
            </span>
          </div>
        </div>
      )}

      {/* Main Report Table Sheet */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Header (Always visible in print) */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Funds Flow
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Working Capital & Funds Flow Summary Table */}
        <div className="overflow-x-auto border-b border-border">
          <table className="w-full border-collapse text-sm">
            {/* Table Column Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]" rowSpan={2}>
                  Particulars
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Working Capital
                </th>
                <th className="p-2 text-right border-l border-border font-bold w-[160px]" rowSpan={2}>
                  Funds Flow
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-2 text-right border-l border-border font-semibold w-[140px]">Opening</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[140px]">Closing</th>
              </tr>
            </thead>

            {/* Table Body - Monthly Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {/* Level 1: Monthly Summary List */}
              {!detailedMonth && (
                activeSummary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground italic">
                      No records found for the selected period
                    </td>
                  </tr>
                ) : (
                  activeSummary.map((item) => {
                    const label = `${item.monthName} ${item.year}`;
                    const isNegative = item.fundsFlow < 0;

                    return (
                      <tr
                        key={item.monthKey}
                        className="group/row hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => {
                          router.push(`?from=${fromParam}&to=${toParam}&month=${item.monthKey}`);
                        }}
                      >
                        <td className="p-3 pl-6 font-medium">
                          <div className="flex items-center justify-between">
                            <span className="hover:underline hover:text-primary">{item.monthName}</span>
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
                        <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                          {formatAmount(item.openingWorkingCapital)}
                        </td>
                        <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                          {formatAmount(item.closingWorkingCapital)}
                        </td>
                        <td className={`p-2 text-right border-l border-border font-mono font-semibold ${
                          isNegative ? "text-destructive" : "text-primary"
                        }`}>
                          {formatAmount(item.fundsFlow)}
                        </td>
                      </tr>
                    );
                  })
                )
              )}

              {/* Level 2: Detailed Month Working Capital breakdown */}
              {detailedMonth && (
                <>
                  {/* Current Assets Header */}
                  <tr className="bg-muted/10 font-bold">
                    <td className="p-3 pl-6">Current Assets</td>
                    <td colSpan={3}></td>
                  </tr>

                  {/* Ledgers under Current Assets */}
                  {detailedMonth.assets.map((ast) => (
                    <tr key={ast.ledgerId} className="hover:bg-muted/5 font-medium">
                      <td className="p-2.5 pl-12 font-sans text-muted-foreground">{ast.ledgerName}</td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(ast.openingBalance)}
                      </td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(ast.closingBalance)}
                      </td>
                      <td className={`p-2.5 text-right border-l border-border font-mono font-semibold ${ast.flow < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatAmount(ast.flow)}
                      </td>
                    </tr>
                  ))}

                  {/* Closing Stock special row */}
                  {(Math.abs(detailedMonth.openingStock) > 0.01 || Math.abs(detailedMonth.closingStock) > 0.01) && (
                    <tr className="hover:bg-muted/5 font-medium">
                      <td className="p-2.5 pl-12 font-sans text-muted-foreground">Closing Stock</td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(detailedMonth.openingStock)}
                      </td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(detailedMonth.closingStock)}
                      </td>
                      <td className={`p-2.5 text-right border-l border-border font-mono font-semibold ${detailedMonth.closingStock - detailedMonth.openingStock < 0 ? "text-destructive" : "text-primary"}`}>
                        {formatAmount(detailedMonth.closingStock - detailedMonth.openingStock)}
                      </td>
                    </tr>
                  )}

                  {/* Total Current Assets */}
                  <tr className="bg-muted/5 font-bold border-t border-border">
                    <td className="p-3 pl-8">Total Current Assets (A)</td>
                    <td className="p-3 text-right border-l border-border font-mono">
                      {formatAmount(detailedMonth.assets.reduce((sum, x) => sum + x.openingBalance, 0) + detailedMonth.openingStock)}
                    </td>
                    <td className="p-3 text-right border-l border-border font-mono">
                      {formatAmount(detailedMonth.assets.reduce((sum, x) => sum + x.closingBalance, 0) + detailedMonth.closingStock)}
                    </td>
                    <td className={`p-3 text-right border-l border-border font-mono ${
                      (detailedMonth.assets.reduce((sum, x) => sum + x.flow, 0) + (detailedMonth.closingStock - detailedMonth.openingStock)) < 0 ? "text-destructive" : "text-primary"
                    }`}>
                      {formatAmount(detailedMonth.assets.reduce((sum, x) => sum + x.flow, 0) + (detailedMonth.closingStock - detailedMonth.openingStock))}
                    </td>
                  </tr>

                  {/* Current Liabilities Header */}
                  <tr className="bg-muted/10 font-bold border-t border-border">
                    <td className="p-3 pl-6">Current Liabilities</td>
                    <td colSpan={3}></td>
                  </tr>

                  {/* Ledgers under Current Liabilities */}
                  {detailedMonth.liabilities.map((lib) => (
                    <tr key={lib.ledgerId} className="hover:bg-muted/5 font-medium">
                      <td className="p-2.5 pl-12 font-sans text-muted-foreground">{lib.ledgerName}</td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(lib.openingBalance)}
                      </td>
                      <td className="p-2.5 text-right border-l border-border font-mono text-muted-foreground">
                        {formatAmount(lib.closingBalance)}
                      </td>
                      <td className={`p-2.5 text-right border-l border-border font-mono font-semibold ${lib.flow < 0 ? "text-primary" : "text-destructive"}`}>
                        {formatAmount(lib.flow)}
                      </td>
                    </tr>
                  ))}

                  {/* Total Current Liabilities */}
                  <tr className="bg-muted/5 font-bold border-t border-border">
                    <td className="p-3 pl-8">Total Current Liabilities (B)</td>
                    <td className="p-3 text-right border-l border-border font-mono">
                      {formatAmount(detailedMonth.liabilities.reduce((sum, x) => sum + x.openingBalance, 0))}
                    </td>
                    <td className="p-3 text-right border-l border-border font-mono">
                      {formatAmount(detailedMonth.liabilities.reduce((sum, x) => sum + x.closingBalance, 0))}
                    </td>
                    <td className={`p-3 text-right border-l border-border font-mono ${
                      detailedMonth.liabilities.reduce((sum, x) => sum + x.flow, 0) < 0 ? "text-primary" : "text-destructive"
                    }`}>
                      {formatAmount(detailedMonth.liabilities.reduce((sum, x) => sum + x.flow, 0))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              <tr className="border-t border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6">Grand Total</td>
                <td className="p-2 text-right border-l border-border font-mono">
                  {formatAmount(grandOpening)}
                </td>
                <td className="p-2 text-right border-l border-border font-mono">
                  {formatAmount(grandClosing)}
                </td>
                <td className={`p-2 text-right border-l border-border font-mono text-base ${
                  grandFlow < 0 ? "text-destructive" : "text-primary"
                }`}>
                  {formatAmount(grandFlow)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Visual Charts Section (Funds Flow Trend Graph) */}
        {activeSummary.length > 0 && (
          <div className="p-6 bg-card border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Monthly Funds Flow Trend
            </h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (val === 0) return "0";
                      const abs = Math.abs(val);
                      if (abs >= 100000) return `${val / 100000}L`;
                      if (abs >= 1000) return `${val / 1000}K`;
                      return String(val);
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.15 }} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                  <Bar dataKey="value" radius={3}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.value >= 0 ? "var(--primary)" : "var(--destructive)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Omitted Warning Banner */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> months from the summary.
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

      {/* Period Selector Dialog */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApplyPeriod} className="h-10">
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FundsFlowClient(props: FundsFlowClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Funds Flow</span></div>}>
      <FundsFlowContent {...props} />
    </Suspense>
  );
}
