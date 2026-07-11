"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { formatAmount } from "@/lib/utils";
import { useOmittedLines } from "@/lib/hooks";
import { ReportPeriodDialog } from "@/components/ReportPeriodDialog";
import { ReportOmittedBanner } from "@/components/ReportOmittedBanner";

interface VoucherDetail {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: number;
  status: string;
  partyName: string;
  partyLedgerId?: number | null;
}

interface MonthlySummaryItem {
  monthKey: string;
  monthName: string;
  year: number;
  totalVouchers: number;
  cancelledVouchers: number;
  netAmount: number;
  vouchers: VoucherDetail[];
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface DebitNoteRegisterClientProps {
  company: Company;
  monthlySummary: MonthlySummaryItem[];
  canExport: boolean;
}

function DebitNoteRegisterContent({
  company,
  monthlySummary,
  canExport,
}: DebitNoteRegisterClientProps) {
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

  // Drill-down dialog state
  const [selectedMonth, setSelectedMonth] = useState<MonthlySummaryItem | null>(null);

  // Omission lists via reusable hook
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

  // Filter out omitted months
  const activeSummary = monthlySummary.filter(
    (item) => !removedLines.includes(`${item.monthName} ${item.year}`)
  );

  // Calculate Grand Totals
  const totalVouchersSum = activeSummary.reduce((sum, item) => sum + item.totalVouchers, 0);
  const cancelledVouchersSum = activeSummary.reduce((sum, item) => sum + item.cancelledVouchers, 0);
  const netAmountSum = activeSummary.reduce((sum, item) => sum + item.netAmount, 0);

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
          <h1 className="text-xl font-bold text-foreground">Debit Note Register</h1>
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

      {/* Main Report Table Sheet */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Header (Always visible in print) */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Debit Note Register
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Monthly Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Column Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]" rowSpan={2}>
                  Particulars
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Transactions
                </th>
                <th className="p-2 text-right border-l border-border font-bold w-[160px]" rowSpan={2}>
                  Amount
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Total Vouchers</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px] text-destructive/80">(cancelled)</th>
              </tr>
            </thead>

            {/* Table Body - Monthly Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {activeSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground italic">
                    No records found for the selected period
                  </td>
                </tr>
              ) : (
                activeSummary.map((item) => {
                  const label = `${item.monthName} ${item.year}`;
                  const hasVouchers = item.totalVouchers > 0;

                  return (
                    <tr
                      key={item.monthKey}
                      onClick={() => setSelectedMonth(item)}
                      className="group/row hover:bg-muted/10 transition-colors cursor-pointer"
                    >
                      <td className="p-3 pl-6 font-medium">
                        <div className="flex items-center justify-between">
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
                      <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                        {item.totalVouchers > 0 ? item.totalVouchers : "—"}
                      </td>
                      <td className="p-2 text-right border-l border-border font-mono text-destructive">
                        {item.cancelledVouchers > 0 ? item.cancelledVouchers : "—"}
                      </td>
                      <td className="p-2 text-right border-l border-border font-mono font-semibold">
                        {formatAmount(item.netAmount)}
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
                <td className="p-2 text-right border-l border-border font-mono">
                  {totalVouchersSum > 0 ? totalVouchersSum : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-destructive">
                  {cancelledVouchersSum > 0 ? cancelledVouchersSum : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-base">
                  {formatAmount(netAmountSum)}
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
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Debit Notes - {selectedMonth?.monthName} {selectedMonth?.year}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border font-bold text-muted-foreground text-xs uppercase bg-muted/20">
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Voucher No</th>
                  <th className="text-left py-2.5 px-3">Particulars (Party Name)</th>
                  <th className="text-center py-2.5 px-3">Status</th>
                  <th className="text-right py-2.5 px-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!selectedMonth?.vouchers || selectedMonth.vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground italic">
                      No debit note vouchers found for this month
                    </td>
                  </tr>
                ) : (
                  selectedMonth.vouchers.map((v) => (
                  <tr
                    key={v.voucherId}
                    className={`hover:bg-muted/10 transition-colors ${
                      v.status === "cancelled" ? "bg-destructive/5 text-muted-foreground" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      {new Date(v.voucherDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">{v.voucherNo}</td>
                    <td className="py-3 px-3">
                      {v.partyLedgerId ? (
                        <a
                          href={`/dashboard/reports/ledger-report?ledgerId=${v.partyLedgerId}`}
                          className="text-primary hover:underline font-semibold"
                        >
                          {v.partyName}
                        </a>
                      ) : (
                        v.partyName
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                          v.status === "cancelled"
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : v.status === "draft"
                            ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                            : "bg-primary/10 text-primary border border-primary/20"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${
                      v.status === "cancelled" ? "line-through text-muted-foreground/60" : ""
                    }`}>
                      {formatAmount(v.netAmount)}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DebitNoteRegisterClient(props: DebitNoteRegisterClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Debit Note Register</span></div>}>
      <DebitNoteRegisterContent {...props} />
    </Suspense>
  );
}
