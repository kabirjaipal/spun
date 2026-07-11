"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface CashFlowItem {
  ledgerId: number;
  ledgerName: string;
  amount: number;
}

interface CashFlowGroup {
  groupId: number;
  groupName: string;
  amount: number;
  items: CashFlowItem[];
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface CashFlowSummaryClientProps {
  company: Company;
  inflowGroups: CashFlowGroup[];
  outflowGroups: CashFlowGroup[];
  canExport: boolean;
}

function CashFlowSummaryContent({
  company,
  inflowGroups,
  outflowGroups,
  canExport,
}: CashFlowSummaryClientProps) {
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

  const [isDetailed, setIsDetailed] = useState(true);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);

  // Omission lists
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

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

  // Filter groups and nested items based on omitted lines
  const processGroups = (groups: CashFlowGroup[]) => {
    return groups
      .filter((g) => !removedLines.includes(g.groupName))
      .map((g) => {
        const filteredItems = g.items.filter((i) => !removedLines.includes(i.ledgerName));
        const totalAmount = filteredItems.reduce((sum, i) => sum + i.amount, 0);
        return {
          ...g,
          items: filteredItems,
          amount: totalAmount,
        };
      })
      .filter((g) => g.items.length > 0 || g.amount !== 0);
  };

  const activeInflowGroups = processGroups(inflowGroups);
  const activeOutflowGroups = processGroups(outflowGroups);

  const totalInflow = activeInflowGroups.reduce((sum, g) => sum + g.amount, 0);
  const totalOutflow = activeOutflowGroups.reduce((sum, g) => sum + g.amount, 0);

  const netDiff = totalInflow - totalOutflow;
  const isNetInflow = netDiff >= 0;

  // Print PDF trigger
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
          <h1 className="text-xl font-bold text-foreground">Cash Flow Summary</h1>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Detailed/Condensed Toggle */}
          <Button
            variant="outline"
            onClick={() => setIsDetailed(!isDetailed)}
            className="flex items-center gap-2"
          >
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed" : "Detailed"}
          </Button>

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

      {/* Main Report Layout */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Header (Always visible in print) */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Cash Flow Summary
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Side-by-Side Inflow & Outflow Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 text-sm min-h-[350px] divide-y md:divide-y-0 md:divide-x divide-border">
          {/* 1. Inflow Column (Left) */}
          <div className="flex flex-col">
            {/* Header row */}
            <div className="flex justify-between items-center bg-muted/30 p-3 font-bold uppercase tracking-wider text-xs border-b border-border text-muted-foreground">
              <span>Inflow</span>
              <span>1-Apr-25 to 30-Apr-25</span>
            </div>

            {/* List items */}
            <div className="flex-1 p-1">
              {activeInflowGroups.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No inflow recorded in this period</div>
              ) : (
                activeInflowGroups.map((grp) => (
                  <div key={grp.groupName} className="group/row border-b border-border/20 last:border-0">
                    <div className="flex justify-between items-center p-3 hover:bg-muted/30">
                      <span className="font-bold text-foreground">{grp.groupName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground font-mono">
                          {formatAmount(grp.amount)}
                        </span>
                        <button
                          onClick={() => handleRemoveLine(grp.groupName)}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-1 no-print font-normal"
                        >
                          Omit
                        </button>
                      </div>
                    </div>

                    {/* Detailed Nested Ledgers */}
                    {isDetailed && grp.items && (
                      <div className="pl-6 pb-2 space-y-1">
                        {grp.items.map((i) => (
                          <div key={i.ledgerId} className="flex justify-between items-center py-1 px-3 text-xs text-foreground/90 group/ledg">
                            <span className="italic">{i.ledgerName}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{formatAmount(i.amount)}</span>
                              <button
                                onClick={() => handleRemoveLine(i.ledgerName)}
                                className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline p-1 no-print"
                              >
                                Omit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Column Total */}
            <div className="border-t border-border p-3 font-bold bg-muted/20 flex justify-between items-center">
              <span>Total Inflow</span>
              <span className="font-mono text-base">{formatAmount(totalInflow)}</span>
            </div>
          </div>

          {/* 2. Outflow Column (Right) */}
          <div className="flex flex-col">
            {/* Header row */}
            <div className="flex justify-between items-center bg-muted/30 p-3 font-bold uppercase tracking-wider text-xs border-b border-border text-muted-foreground">
              <span>Outflow</span>
              <span>1-Apr-25 to 30-Apr-25</span>
            </div>

            {/* List items */}
            <div className="flex-1 p-1">
              {activeOutflowGroups.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No outflow recorded in this period</div>
              ) : (
                activeOutflowGroups.map((grp) => (
                  <div key={grp.groupName} className="group/row border-b border-border/20 last:border-0">
                    <div className="flex justify-between items-center p-3 hover:bg-muted/30">
                      <span className="font-bold text-foreground">{grp.groupName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground font-mono">
                          {formatAmount(grp.amount)}
                        </span>
                        <button
                          onClick={() => handleRemoveLine(grp.groupName)}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-1 no-print font-normal"
                        >
                          Omit
                        </button>
                      </div>
                    </div>

                    {/* Detailed Nested Ledgers */}
                    {isDetailed && grp.items && (
                      <div className="pl-6 pb-2 space-y-1">
                        {grp.items.map((i) => (
                          <div key={i.ledgerId} className="flex justify-between items-center py-1 px-3 text-xs text-foreground/90 group/ledg">
                            <span className="italic">{i.ledgerName}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{formatAmount(i.amount)}</span>
                              <button
                                onClick={() => handleRemoveLine(i.ledgerName)}
                                className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline p-1 no-print"
                              >
                                Omit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Column Total */}
            <div className="border-t border-border p-3 font-bold bg-muted/20 flex justify-between items-center">
              <span>Total Outflow</span>
              <span className="font-mono text-base">{formatAmount(totalOutflow)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Banner - Nett Balance */}
        <div className="border-t border-border p-4 bg-muted/40 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Nett Cash Movement Summary
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-foreground">
              {isNetInflow ? "Nett Inflow:" : "Nett Outflow:"}
            </span>
            <span className={`text-xl font-extrabold font-mono tracking-tight ${
              isNetInflow ? "text-primary" : "text-destructive"
            }`}>
              {formatAmount(netDiff)}
            </span>
          </div>
        </div>
      </div>

      {/* Omitted Warning Banner */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> items from the structure.
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
                onChange={(e) => setStartDate(e.target.value)}
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
                onChange={(e) => setEndDate(e.target.value)}
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

export default function CashFlowSummaryClient(props: CashFlowSummaryClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Cash Flow Summary</span></div>}>
      <CashFlowSummaryContent {...props} />
    </Suspense>
  );
}
