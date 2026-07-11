"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { formatAmount, formatDateToTally } from "@/lib/utils";
import { useOmittedLines } from "@/lib/hooks";
import { ReportPeriodDialog } from "@/components/ReportPeriodDialog";
import { ReportOmittedBanner } from "@/components/ReportOmittedBanner";

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

interface MonthlySummaryItem {
  monthKey: string;
  monthName: string;
  year: number;
  totalVouchers: number;
  cancelledVouchers: number;
  netAmount: number;
  vouchers: Voucher[];
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface JournalRegisterClientProps {
  company: Company;
  monthlySummary: MonthlySummaryItem[];
  canExport: boolean;
}

function JournalRegisterContent({
  company,
  monthlySummary,
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
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");

  // Drill-down dialog state
  const [selectedMonth, setSelectedMonth] = useState<MonthlySummaryItem | null>(null);

  // Omission list via custom hook
  const {
    removedLines,
    handleRemoveLine,
    handleRestoreLine,
    handleRestoreAll,
  } = useOmittedLines();

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // Get primary debited ledger name for the summary line particulars
  const getParticularsText = (v: Voucher) => {
    const debitEntry = v.entries.find((e) => e.entryType === "debit");
    return debitEntry ? debitEntry.ledgerName : "No Debit Posting";
  };

  // Filter out omitted months
  const activeSummary = monthlySummary.filter(
    (item) => !removedLines.includes(`${item.monthName} ${item.year}`)
  );

  // Search filtering by month name
  const searchedSummary = activeSummary.filter((item) =>
    item.monthName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate Grand Totals of visible months
  const totalVouchersSum = searchedSummary.reduce((sum, item) => sum + item.totalVouchers, 0);
  const cancelledVouchersSum = searchedSummary.reduce((sum, item) => sum + item.cancelledVouchers, 0);
  const netAmountSum = searchedSummary.reduce((sum, item) => sum + item.netAmount, 0);

  const triggerPrint = () => {
    window.print();
  };

  // Filter vouchers inside the drill-down dialog
  const getFilteredDialogVouchers = (vouchers: Voucher[]) => {
    if (!dialogSearchQuery) return vouchers;
    const term = dialogSearchQuery.toLowerCase();
    return vouchers.filter((v) => {
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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Journal Register</h1>
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
            Journal Register
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
                <th className="p-3 text-right border-l border-border w-[160px]">Total Vouchers</th>
                <th className="p-3 text-right border-l border-border w-[160px] text-destructive">(cancelled)</th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {searchedSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground italic">
                    No journal data found for the selected period
                  </td>
                </tr>
              ) : (
                searchedSummary.map((item) => {
                  const label = `${item.monthName} ${item.year}`;
                  const hasVouchers = item.totalVouchers > 0;

                  return (
                    <tr
                      key={item.monthKey}
                      className="group/row hover:bg-muted/10 transition-colors font-medium cursor-pointer"
                      onClick={() => {
                        setDialogSearchQuery("");
                        setSelectedMonth(item);
                      }}
                    >
                      {/* Particulars (Month Name) */}
                      <td className="p-3 pl-6 font-semibold text-foreground">
                        <div className="flex items-center justify-between w-full">
                          <span>{item.monthName}</span>
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

                      {/* Total Vouchers */}
                      <td className="p-3 text-right border-l border-border font-mono text-muted-foreground">
                        {item.totalVouchers > 0 ? item.totalVouchers : "—"}
                      </td>

                      {/* Cancelled Vouchers */}
                      <td className="p-3 text-right border-l border-border font-mono text-destructive">
                        {item.cancelledVouchers > 0 ? item.cancelledVouchers : "—"}
                      </td>

                      {/* Closing Balance / Net Amount for the month */}
                      <td className="p-3 text-right border-l border-border font-mono font-bold text-foreground">
                        {formatAmount(item.netAmount)} Debit
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6">Grand Total</td>
                <td className="p-3 text-right border-l border-border font-mono text-foreground">
                  {totalVouchersSum > 0 ? totalVouchersSum : "—"}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-destructive">
                  {cancelledVouchersSum > 0 ? cancelledVouchersSum : "—"}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                  {formatAmount(netAmountSum)} Debit
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ReportOmittedBanner
        count={removedLines.length}
        itemName="months"
        onRestoreLast={handleRestoreLine}
        onRestoreAll={handleRestoreAll}
      />

      <ReportPeriodDialog
        open={showPeriodModal}
        onOpenChange={setShowPeriodModal}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApplyPeriod}
      />

      {/* Monthly Voucher Drill-down Listing Dialog */}
      <Dialog open={selectedMonth !== null} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DialogTitle className="text-lg font-bold">
              Journals — {selectedMonth?.monthName} {selectedMonth?.year}
            </DialogTitle>
            <div className="flex items-center gap-3 pr-6 no-print">
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search inside month..."
                  value={dialogSearchQuery}
                  onChange={(e) => setDialogSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background border-border"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailed(!isDetailed)}
                className="h-8 text-xs flex items-center gap-1 animate-none"
              >
                {isDetailed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isDetailed ? "Condensed" : "Detailed"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNarration(!showNarration)}
                className="h-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {showNarration ? "Hide Narration" : "Show Narration"}
              </Button>
            </div>
          </DialogHeader>

          <div className="py-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 text-left w-[120px]">Date</th>
                  <th className="p-3 text-left min-w-[220px]">Particulars</th>
                  <th className="p-3 text-left w-[130px]">Vch Type</th>
                  <th className="p-3 text-left w-[110px]">Vch No.</th>
                  <th className="p-3 text-right border-l border-border w-[140px]">Debit Amount</th>
                  <th className="p-3 text-right border-l border-border w-[140px]">Credit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-foreground">
                {selectedMonth && getFilteredDialogVouchers(selectedMonth.vouchers).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                      No journal vouchers matched search criteria
                    </td>
                  </tr>
                ) : (
                  selectedMonth && getFilteredDialogVouchers(selectedMonth.vouchers).map((v) => {
                    const particulars = getParticularsText(v);
                    const isVchCancelled = v.status === "cancelled";
                    return (
                      <React.Fragment key={v.voucherId}>
                        <tr className={`group/row hover:bg-muted/10 transition-colors font-medium ${isVchCancelled ? "bg-destructive/5 text-muted-foreground" : ""}`}>
                          <td className="p-3 font-mono text-xs whitespace-nowrap">
                            {formatDateToTally(v.voucherDate)}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {particulars}
                          </td>
                          <td className="p-3 text-muted-foreground">Journal</td>
                          <td className="p-3 font-mono text-xs">{v.voucherNo}</td>
                          <td className={`p-3 text-right border-l border-border font-mono font-bold ${isVchCancelled ? "line-through text-muted-foreground/60" : ""}`}>
                            {formatAmount(v.netAmount)}
                          </td>
                          <td className="p-3 text-right border-l border-border font-mono text-muted-foreground">—</td>
                        </tr>

                        {isDetailed && (
                          <>
                            {v.entries.map((entry) => (
                              <tr
                                key={entry.entryId}
                                className="bg-muted/5 hover:bg-muted/15 transition-colors border-t border-border/20"
                              >
                                <td className="p-2"></td>
                                <td className="p-2 text-xs italic pl-8 text-foreground/80">
                                  {entry.entryType === "credit" ? (
                                    <span className="pl-4">
                                      To{" "}
                                      <a
                                        href={`/dashboard/reports/ledger-report?ledgerId=${entry.ledgerId}`}
                                        className="text-primary hover:underline font-semibold"
                                      >
                                        {entry.ledgerName}
                                      </a>
                                    </span>
                                  ) : (
                                    <span>
                                      <a
                                        href={`/dashboard/reports/ledger-report?ledgerId=${entry.ledgerId}`}
                                        className="text-primary hover:underline font-semibold"
                                      >
                                        {entry.ledgerName}
                                      </a>
                                    </span>
                                  )}
                                </td>
                                <td className="p-2"></td>
                                <td className="p-2"></td>
                                <td className="p-2 text-right border-l border-border text-xs font-mono text-foreground/80">
                                  {entry.entryType === "debit" ? formatAmount(entry.amount) : "—"}
                                </td>
                                <td className="p-2 text-right border-l border-border text-xs font-mono text-foreground/80">
                                  {entry.entryType === "credit" ? formatAmount(entry.amount) : "—"}
                                </td>
                              </tr>
                            ))}

                            {showNarration && v.remarks && (
                              <tr className="bg-muted/5 border-t border-border/20">
                                <td className="p-1"></td>
                                <td colSpan={5} className="p-2 pl-12 text-xs text-muted-foreground italic">
                                  Narration: {v.remarks}
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
