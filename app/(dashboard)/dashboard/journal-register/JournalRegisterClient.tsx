"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface VoucherEntry {
  entryId: number;
  entryType: "debit" | "credit";
  amount: number;
  ledgerId: number;
  ledgerName: string;
}

interface Voucher {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  netAmount: number;
  remarks: string | null;
  status: string;
  entries: VoucherEntry[];
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface JournalRegisterClientProps {
  company: Company;
  vouchers: Voucher[];
  canExport: boolean;
}

function JournalRegisterContent({
  company,
  vouchers,
  canExport,
}: JournalRegisterClientProps) {
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

  const [isDetailed, setIsDetailed] = useState(false);
  const [showNarration, setShowNarration] = useState(true);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Get primary debited ledger name for the summary line particulars
  const getParticularsText = (v: Voucher) => {
    const debitEntry = v.entries.find((e) => e.entryType === "debit");
    return debitEntry ? debitEntry.ledgerName : "No Debit Posting";
  };

  // Filter out omitted items
  const activeVouchers = vouchers.filter((v) => !removedLines.includes(String(v.voucherId)));

  // Filter based on search query
  const filteredVouchers = activeVouchers.filter((v) => {
    const term = searchQuery.toLowerCase();
    const particulars = getParticularsText(v).toLowerCase();
    const vchNo = v.voucherNo.toLowerCase();
    const remarks = (v.remarks || "").toLowerCase();
    const allLedgers = v.entries.map((e) => e.ledgerName.toLowerCase()).join(" ");

    return (
      particulars.includes(term) ||
      vchNo.includes(term) ||
      remarks.includes(term) ||
      allLedgers.includes(term)
    );
  });

  // Calculate Grand Totals of visible journal vouchers
  const totalDebitSum = filteredVouchers.reduce((sum, v) => sum + v.netAmount, 0);

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

      {/* Page Title & Navigation Controls (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Journal Register</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search journals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border h-10 text-sm"
            />
          </div>

          {/* Detailed/Condensed toggle */}
          <Button
            variant="outline"
            onClick={() => setIsDetailed(!isDetailed)}
            className="flex items-center gap-2"
          >
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed View" : "Detailed View"}
          </Button>

          {/* Show/Hide Narration toggle */}
          <Button
            variant="outline"
            onClick={() => setShowNarration(!showNarration)}
            className="flex items-center gap-2"
          >
            {showNarration ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showNarration ? "Hide Narration" : "Show Narration"}
          </Button>

          {/* Period Date Dialog Button */}
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
            Voucher Register (Journal)
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
                <th className="p-3 text-left pl-6 w-[120px]">Date</th>
                <th className="p-3 text-left min-w-[220px]">Particulars</th>
                <th className="p-3 text-left w-[130px]">Vch Type</th>
                <th className="p-3 text-left w-[110px]">Vch No.</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Debit Amount</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Credit Amount</th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                    No journal vouchers found for the selected period
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const particulars = getParticularsText(v);
                  return (
                    <React.Fragment key={v.voucherId}>
                      {/* Main Voucher Row */}
                      <tr className="group/row hover:bg-muted/10 transition-colors font-medium">
                        {/* Date */}
                        <td className="p-3 pl-6 font-mono text-xs whitespace-nowrap">
                          {formatDateToTally(v.voucherDate)}
                        </td>

                        {/* Particulars */}
                        <td className="p-3 font-semibold text-foreground">
                          <div className="flex items-center justify-between">
                            <span>{particulars}</span>
                            <button
                              onClick={() => handleRemoveLine(String(v.voucherId))}
                              className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                            >
                              Omit
                            </button>
                          </div>
                        </td>

                        {/* Voucher Type */}
                        <td className="p-3 text-muted-foreground">Journal</td>

                        {/* Voucher No */}
                        <td className="p-3 font-mono text-xs">{v.voucherNo}</td>

                        {/* Debit */}
                        <td className="p-3 text-right border-l border-border font-mono font-bold">
                          {formatAmount(v.netAmount)}
                        </td>

                        {/* Credit (Blank for summary row) */}
                        <td className="p-3 text-right border-l border-border font-mono text-muted-foreground">
                          —
                        </td>
                      </tr>

                      {/* Detailed Postings Sub-Rows (Rendered if isDetailed is active) */}
                      {isDetailed && (
                        <>
                          {/* List entries */}
                          {v.entries.map((entry) => (
                            <tr
                              key={entry.entryId}
                              className="bg-muted/5 hover:bg-muted/15 transition-colors border-t border-border/20"
                            >
                              <td className="p-2 pl-6"></td>
                              <td className="p-2 text-xs italic pl-8 text-foreground/80">
                                {entry.entryType === "credit" ? (
                                  <span className="pl-4">To {entry.ledgerName}</span>
                                ) : (
                                  <span>{entry.ledgerName}</span>
                                )}
                              </td>
                              <td className="p-2"></td>
                              <td className="p-2"></td>
                              {/* Debit sub-amount */}
                              <td className="p-2 text-right border-l border-border text-xs font-mono text-foreground/80">
                                {entry.entryType === "debit" ? formatAmount(entry.amount) : "—"}
                              </td>
                              {/* Credit sub-amount */}
                              <td className="p-2 text-right border-l border-border text-xs font-mono text-foreground/80">
                                {entry.entryType === "credit" ? formatAmount(entry.amount) : "—"}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                      
                      {/* Remarks / Narration Row if present and showNarration is active */}
                      {showNarration && v.remarks && (
                        <tr className="bg-muted/5 border-t border-border/20">
                          <td className="p-1 pl-6"></td>
                          <td colSpan={5} className="p-2 pl-12 text-xs text-muted-foreground italic">
                            Narration: {v.remarks}
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
                <td className="p-3 pl-6" colSpan={4}>
                  Total
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                  {formatAmount(totalDebitSum)}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-muted-foreground">
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Omitted Rows Warning Alert (Hidden on print) */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> journal vouchers from the register display.
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

export default function JournalRegisterClient(props: JournalRegisterClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Journal Register</span></div>}>
      <JournalRegisterContent {...props} />
    </Suspense>
  );
}
