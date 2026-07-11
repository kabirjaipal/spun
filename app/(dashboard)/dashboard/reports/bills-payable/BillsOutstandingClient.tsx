"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Search, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface OutstandingBill {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  partyName: string;
  netAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate: string;
  creditDays: number;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface BillsOutstandingClientProps {
  company: Company;
  type: "payable" | "receivable";
  bills: OutstandingBill[];
  canExport: boolean;
}

function BillsOutstandingContent({
  company,
  type,
  bills,
  canExport,
}: BillsOutstandingClientProps) {
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

  // Omission lists
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  const handleToggleType = () => {
    const route = type === "payable" ? "bills-receivable" : "bills-payable";
    router.push(`/dashboard/${route}?from=${fromParam}&to=${toParam}`);
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

  // Calculate overdue days relative to period end date (reportDate)
  const computeOverdueDays = (dueDateStr: string, reportDateStr: string) => {
    const due = new Date(dueDateStr + "T00:00:00");
    const report = new Date(reportDateStr + "T00:00:00");
    if (report <= due) return "—";
    const diffTime = report.getTime() - due.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
  const searchedBills = bills.filter((b) => {
    const term = searchQuery.toLowerCase();
    return (
      b.partyName.toLowerCase().includes(term) ||
      b.voucherNo.toLowerCase().includes(term)
    );
  });

  // Omission filtering
  const visibleBills = searchedBills.filter(
    (b) => !removedLines.includes(String(b.voucherId))
  );

  // Calculate grand totals of visible outstanding balances
  const grandTotalPending = visibleBills.reduce((sum, b) => sum + b.pendingAmount, 0);

  const triggerPrint = () => {
    window.print();
  };

  const reportTitle = type === "payable" ? "Bills Payable" : "Bills Receivable";

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
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {reportTitle}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ref no or party..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border h-10 text-sm"
            />
          </div>

          {/* Toggle Type Button (Payable vs Receivable) */}
          <Button
            variant="outline"
            onClick={handleToggleType}
            className="flex items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {type === "payable" ? "Bills Receivable" : "Bills Payable"}
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
            {reportTitle}
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
                <th className="p-3 text-left pl-6 w-[120px]" rowSpan={2}>
                  Date
                </th>
                <th className="p-3 text-left w-[130px]" rowSpan={2}>
                  Ref. No.
                </th>
                <th className="p-3 text-left min-w-[200px]" rowSpan={2}>
                  Party's Name
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={3}>
                  Pending Bills
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-right border-l border-border w-[140px]">Pending Amount</th>
                <th className="p-3 text-right border-l border-border w-[120px]">Due on</th>
                <th className="p-3 text-right border-l border-border w-[120px]">Overdue by days</th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {visibleBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                    No pending bills outstanding for this period
                  </td>
                </tr>
              ) : (
                visibleBills.map((b) => {
                  const overdueDays = computeOverdueDays(b.dueDate, toParam);

                  return (
                    <tr
                      key={b.voucherId}
                      className="group/row hover:bg-muted/10 transition-colors font-medium"
                    >
                      {/* Date */}
                      <td className="p-3 pl-6 font-mono text-xs whitespace-nowrap">
                        {formatDateToTally(b.voucherDate)}
                      </td>

                      {/* Ref No. */}
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {b.voucherNo}
                      </td>

                      {/* Party Name */}
                      <td className="p-3 font-semibold text-foreground">
                        <div className="flex items-center justify-between">
                          <span>{b.partyName}</span>
                          <button
                            onClick={() => handleRemoveLine(String(b.voucherId))}
                            className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                          >
                            Omit
                          </button>
                        </div>
                      </td>

                      {/* Pending Amount */}
                      <td className="p-3 text-right border-l border-border font-mono font-bold">
                        {formatAmount(b.pendingAmount)}
                      </td>

                      {/* Due on Date */}
                      <td className="p-3 text-right border-l border-border font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateToTally(b.dueDate)}
                      </td>

                      {/* Overdue by days */}
                      <td className="p-3 text-right border-l border-border font-mono font-bold text-destructive">
                        {overdueDays}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6" colSpan={3}>
                  Total
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                  {formatAmount(grandTotalPending)}
                </td>
                <td className="p-3 border-l border-border"></td>
                <td className="p-3 border-l border-border"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Omitted Rows Warning Alert (Hidden on print) */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> outstanding bills from the display.
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

export default function BillsOutstandingClient(props: BillsOutstandingClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Outstanding Bills</span></div>}>
      <BillsOutstandingContent {...props} />
    </Suspense>
  );
}
