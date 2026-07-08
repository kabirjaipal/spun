"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface LedgerSummary {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  openingBalance: number;
  debitPeriod: number;
  creditPeriod: number;
  closingBalance: number;
  isCash: boolean;
  isBank: boolean;
}

interface CashBankSummaryClientProps {
  company: Company;
  ledgers: LedgerSummary[];
  canExport: boolean;
}

function CashBankSummaryContent({
  company,
  ledgers,
  canExport,
}: CashBankSummaryClientProps) {
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
  const [showOpening, setShowOpening] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
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
    if (val === 0) return "—";
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

  // Filter ledgers by omission list
  const activeLedgers = ledgers.filter(
    (l) => !removedLines.includes(l.ledgerName) && !removedLines.includes(`ledger-${l.ledgerId}`)
  );

  // Cash ledgers group
  const cashLedgers = activeLedgers.filter((l) => l.isCash);
  // Bank ledgers group
  const bankLedgers = activeLedgers.filter((l) => l.isBank);

  // Category Rollups
  const getGroupRollup = (groupLedgers: LedgerSummary[]) => {
    const opening = groupLedgers.reduce((sum, l) => sum + l.openingBalance, 0);
    const debit = groupLedgers.reduce((sum, l) => sum + l.debitPeriod, 0);
    const credit = groupLedgers.reduce((sum, l) => sum + l.creditPeriod, 0);
    const closing = groupLedgers.reduce((sum, l) => sum + l.closingBalance, 0);
    return { opening, debit, credit, closing };
  };

  const cashRollup = getGroupRollup(cashLedgers);
  const bankRollup = getGroupRollup(bankLedgers);

  // Grand Totals calculations
  const getGrandTotals = () => {
    let openDebit = 0;
    let openCredit = 0;
    let periodDebit = 0;
    let periodCredit = 0;
    let closingDebit = 0;
    let closingCredit = 0;

    // Apply rollup rules for categories (Cash-in-Hand, Bank Accounts)
    // For Cash-in-Hand:
    if (cashRollup.opening >= 0) openDebit += cashRollup.opening;
    else openCredit += Math.abs(cashRollup.opening);

    periodDebit += cashRollup.debit;
    periodCredit += cashRollup.credit;

    if (cashRollup.closing >= 0) closingDebit += cashRollup.closing;
    else closingCredit += Math.abs(cashRollup.closing);

    // For Bank Accounts:
    if (bankRollup.opening >= 0) openDebit += bankRollup.opening;
    else openCredit += Math.abs(bankRollup.opening);

    periodDebit += bankRollup.debit;
    periodCredit += bankRollup.credit;

    if (bankRollup.closing >= 0) closingDebit += bankRollup.closing;
    else closingCredit += Math.abs(bankRollup.closing);

    return { openDebit, openCredit, periodDebit, periodCredit, closingDebit, closingCredit };
  };

  const grandTotals = getGrandTotals();

  // Print trigger
  const triggerPrint = () => {
    window.print();
  };

  // Helper to determine text styles for negative cash
  const getAmountClass = (val: number, side: "debit" | "credit") => {
    // Standard font family and size, red for negative balance
    const base = "font-mono font-medium";
    if (val < 0) {
      return `${base} text-destructive`;
    }
    return base;
  };

  return (
    <div className="space-y-6">
      {/* Minimal print styling to override layout margins and remove browser header/footer URL/date timestamps */}
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

      {/* Title & Control Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cash/Bank Summary</h1>
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

          {/* Show Opening Balance Option */}
          <Button
            variant={showOpening ? "secondary" : "outline"}
            onClick={() => setShowOpening(!showOpening)}
            className="flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            Opening
          </Button>

          {/* Show Transactions Option */}
          <Button
            variant={showTransactions ? "secondary" : "outline"}
            onClick={() => setShowTransactions(!showTransactions)}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Transactions
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

      {/* Main Report Table Sheet */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Header (Always visible in print, clean styling) */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Cash/Bank Summary
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Column Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]" rowSpan={2}>
                  Particulars
                </th>
                {showOpening && (
                  <th className="p-2 text-center border-l border-border" colSpan={2}>
                    Opening Balance
                  </th>
                )}
                {showTransactions && (
                  <th className="p-2 text-center border-l border-border" colSpan={2}>
                    Transactions
                  </th>
                )}
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Closing Balance
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                {showOpening && (
                  <>
                    <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                    <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
                  </>
                )}
                {showTransactions && (
                  <>
                    <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                    <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
                  </>
                )}
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
              </tr>
            </thead>

            {/* Table Rows Body */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {/* 1. Cash-in-Hand Category */}
              {(!removedLines.includes("Cash-in-Hand")) && (
                <>
                  <tr className="hover:bg-muted/10 group/row font-semibold">
                    <td className="p-3 pl-6">
                      <div className="flex items-center justify-between">
                        <span>Cash-in-Hand</span>
                        <button
                          onClick={() => handleRemoveLine("Cash-in-Hand")}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                        >
                          Omit
                        </button>
                      </div>
                    </td>
                    {showOpening && (
                      <>
                        <td className="p-2 text-right border-l border-border font-mono">
                          {cashRollup.opening >= 0 ? formatAmount(cashRollup.opening) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border font-mono text-destructive">
                          {cashRollup.opening < 0 ? formatAmount(cashRollup.opening) : "—"}
                        </td>
                      </>
                    )}
                    {showTransactions && (
                      <>
                        <td className="p-2 text-right border-l border-border font-mono">
                          {cashRollup.debit > 0 ? formatAmount(cashRollup.debit) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border font-mono">
                          {cashRollup.credit > 0 ? formatAmount(cashRollup.credit) : "—"}
                        </td>
                      </>
                    )}
                    <td className="p-2 text-right border-l border-border font-mono">
                      {cashRollup.closing >= 0 ? formatAmount(cashRollup.closing) : "—"}
                    </td>
                    <td className="p-2 text-right border-l border-border font-mono text-destructive">
                      {cashRollup.closing < 0 ? formatAmount(cashRollup.closing) : "—"}
                    </td>
                  </tr>

                  {/* Cash nested ledgers (Detailed view) */}
                  {isDetailed &&
                    cashLedgers.map((l) => (
                      <tr key={l.ledgerId} className="hover:bg-muted/5 group/ledg text-xs font-normal">
                        <td className="p-2 pl-12 italic text-foreground/90">
                          <div className="flex items-center justify-between">
                            <span>{l.ledgerName}</span>
                            <button
                              onClick={() => handleRemoveLine(l.ledgerName)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline p-1 ml-2 no-print"
                            >
                              Omit
                            </button>
                          </div>
                        </td>
                        {showOpening && (
                          <>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.openingBalance >= 0 ? formatAmount(l.openingBalance) : "—"}
                            </td>
                            <td className="p-2 text-right border-l border-border font-mono text-destructive">
                              {l.openingBalance < 0 ? formatAmount(l.openingBalance) : "—"}
                            </td>
                          </>
                        )}
                        {showTransactions && (
                          <>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.debitPeriod > 0 ? formatAmount(l.debitPeriod) : "—"}
                            </td>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.creditPeriod > 0 ? formatAmount(l.creditPeriod) : "—"}
                            </td>
                          </>
                        )}
                        <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                          {l.closingBalance >= 0 ? formatAmount(l.closingBalance) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border font-mono text-destructive">
                          {l.closingBalance < 0 ? formatAmount(l.closingBalance) : "—"}
                        </td>
                      </tr>
                    ))}
                </>
              )}

              {/* 2. Bank Accounts Category */}
              {(!removedLines.includes("Bank Accounts")) && (
                <>
                  <tr className="hover:bg-muted/10 group/row font-semibold">
                    <td className="p-3 pl-6 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span>Bank Accounts</span>
                        <button
                          onClick={() => handleRemoveLine("Bank Accounts")}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                        >
                          Omit
                        </button>
                      </div>
                    </td>
                    {showOpening && (
                      <>
                        <td className="p-2 text-right border-l border-border border-t font-mono">
                          {bankRollup.opening >= 0 ? formatAmount(bankRollup.opening) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border border-t font-mono text-destructive">
                          {bankRollup.opening < 0 ? formatAmount(bankRollup.opening) : "—"}
                        </td>
                      </>
                    )}
                    {showTransactions && (
                      <>
                        <td className="p-2 text-right border-l border-border border-t font-mono">
                          {bankRollup.debit > 0 ? formatAmount(bankRollup.debit) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border border-t font-mono">
                          {bankRollup.credit > 0 ? formatAmount(bankRollup.credit) : "—"}
                        </td>
                      </>
                    )}
                    <td className="p-2 text-right border-l border-border border-t font-mono">
                      {bankRollup.closing >= 0 ? formatAmount(bankRollup.closing) : "—"}
                    </td>
                    <td className="p-2 text-right border-l border-border border-t font-mono text-destructive">
                      {bankRollup.closing < 0 ? formatAmount(bankRollup.closing) : "—"}
                    </td>
                  </tr>

                  {/* Bank nested ledgers (Detailed view) */}
                  {isDetailed &&
                    bankLedgers.map((l) => (
                      <tr key={l.ledgerId} className="hover:bg-muted/5 group/ledg text-xs font-normal">
                        <td className="p-2 pl-12 italic text-foreground/90">
                          <div className="flex items-center justify-between">
                            <span>{l.ledgerName}</span>
                            <button
                              onClick={() => handleRemoveLine(l.ledgerName)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline p-1 ml-2 no-print"
                            >
                              Omit
                            </button>
                          </div>
                        </td>
                        {showOpening && (
                          <>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.openingBalance >= 0 ? formatAmount(l.openingBalance) : "—"}
                            </td>
                            <td className="p-2 text-right border-l border-border font-mono text-destructive">
                              {l.openingBalance < 0 ? formatAmount(l.openingBalance) : "—"}
                            </td>
                          </>
                        )}
                        {showTransactions && (
                          <>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.debitPeriod > 0 ? formatAmount(l.debitPeriod) : "—"}
                            </td>
                            <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                              {l.creditPeriod > 0 ? formatAmount(l.creditPeriod) : "—"}
                            </td>
                          </>
                        )}
                        <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                          {l.closingBalance >= 0 ? formatAmount(l.closingBalance) : "—"}
                        </td>
                        <td className="p-2 text-right border-l border-border font-mono text-destructive">
                          {l.closingBalance < 0 ? formatAmount(l.closingBalance) : "—"}
                        </td>
                      </tr>
                    ))}
                </>
              )}
            </tbody>

            {/* Table Footer (Grand Totals) */}
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6">Grand Total</td>
                {showOpening && (
                  <>
                    <td className="p-2 text-right border-l border-border font-mono">
                      {grandTotals.openDebit > 0 ? formatAmount(grandTotals.openDebit) : "—"}
                    </td>
                    <td className="p-2 text-right border-l border-border font-mono text-destructive">
                      {grandTotals.openCredit > 0 ? formatAmount(grandTotals.openCredit) : "—"}
                    </td>
                  </>
                )}
                {showTransactions && (
                  <>
                    <td className="p-2 text-right border-l border-border font-mono">
                      {grandTotals.periodDebit > 0 ? formatAmount(grandTotals.periodDebit) : "—"}
                    </td>
                    <td className="p-2 text-right border-l border-border font-mono">
                      {grandTotals.periodCredit > 0 ? formatAmount(grandTotals.periodCredit) : "—"}
                    </td>
                  </>
                )}
                <td className="p-2 text-right border-l border-border font-mono">
                  {grandTotals.closingDebit > 0 ? formatAmount(grandTotals.closingDebit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-destructive">
                  {grandTotals.closingCredit > 0 ? formatAmount(grandTotals.closingCredit) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Omitted Warning Banner */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> items from the report structure. The sheet remains mathematically balanced.
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

export default function CashBankSummaryClient(props: CashBankSummaryClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Cash/Bank Summary</span></div>}>
      <CashBankSummaryContent {...props} />
    </Suspense>
  );
}
