"use client";

import React, { useState, Suspense } from "react";
import { Download, Calendar, Search, Folder, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VoucherEntryItem {
  entryId: number;
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  amount: number;
  entryType: "debit" | "credit";
  ledgerId: number;
  ledgerName: string;
}

interface GroupInfo {
  groupId: number;
  groupName: string;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface GroupVouchersClientProps {
  company: Company;
  groups: GroupInfo[];
  selectedGroup: GroupInfo | null;
  reportItems: VoucherEntryItem[];
  canExport: boolean;
}

function GroupVouchersContent({
  company,
  groups,
  selectedGroup,
  reportItems,
  canExport,
}: GroupVouchersClientProps) {
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

  // Omission list
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    const groupIdParam = selectedGroup ? `&groupId=${selectedGroup.groupId}` : "";
    router.push(`?from=${startDate}&to=${endDate}${groupIdParam}`);
  };

  const handleGroupSelect = (groupId: number) => {
    router.push(`?from=${fromParam}&to=${toParam}&groupId=${groupId}`);
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

  // Filter out omitted items
  const activeItems = reportItems.filter((i) => !removedLines.includes(String(i.entryId)));

  // Calculate Grand Totals
  const totalDebit = activeItems.reduce((sum, i) => sum + (i.entryType === "debit" ? i.amount : 0), 0);
  const totalCredit = activeItems.reduce((sum, i) => sum + (i.entryType === "credit" ? i.amount : 0), 0);

  const triggerPrint = () => {
    window.print();
  };

  // 1. Group Selector View (If no group selected)
  if (!selectedGroup) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-card border border-border rounded-lg shadow-sm text-center">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          No Groups Available
        </h2>
        <p className="text-xs text-muted-foreground">
          Please add accounting groups and ledgers before accessing this report.
        </p>
      </div>
    );
  }

  // 2. Group Vouchers Report View
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">
            Group Vouchers: <span className="text-primary font-extrabold">{selectedGroup.groupName}</span>
          </h1>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Group Switcher Dropdown using shadcn Select component */}
          <Select
            value={String(selectedGroup.groupId)}
            onValueChange={(val) => handleGroupSelect(Number(val))}
          >
            <SelectTrigger className="w-[240px] h-10 text-sm font-medium bg-background text-foreground">
              <SelectValue placeholder="Select Group" />
            </SelectTrigger>
            <SelectContent searchable={true}>
              <SelectGroup>
                {groups
                  .sort((a, b) => a.groupName.localeCompare(b.groupName))
                  .map((g) => (
                    <SelectItem key={g.groupId} value={String(g.groupId)}>
                      {g.groupName}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>

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
            Group Vouchers Report ({selectedGroup.groupName})
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Vouchers Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Column Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 w-[120px]">Date</th>
                <th className="p-3 text-left min-w-[200px]">Particulars</th>
                <th className="p-3 text-left w-[140px]">Voucher Type</th>
                <th className="p-3 text-left w-[120px]">Voucher No.</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Debit</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Credit</th>
              </tr>
            </thead>

            {/* Table Body - Voucher Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {activeItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                    No transactions found for this period
                  </td>
                </tr>
              ) : (
                activeItems.map((item) => (
                  <tr
                    key={item.entryId}
                    className="group/row hover:bg-muted/10 transition-colors"
                  >
                    <td className="p-3 pl-6 font-medium whitespace-nowrap">
                      {new Date(item.voucherDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/dashboard/ledger-report?ledgerId=${item.ledgerId}&from=${fromParam}&to=${toParam}`}
                          className="font-medium text-foreground hover:underline hover:text-primary truncate"
                        >
                          {item.ledgerName}
                        </Link>
                        <button
                          onClick={() => handleRemoveLine(String(item.entryId))}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal shrink-0"
                        >
                          Omit
                        </button>
                      </div>
                    </td>
                    <td className="p-3 capitalize whitespace-nowrap text-muted-foreground">
                      {(item.voucherType || "").replace("_", " ")}
                    </td>
                    <td className="p-3 font-mono font-semibold text-muted-foreground">
                      {item.voucherNo}
                    </td>
                    <td className="p-3 text-right border-l border-border font-mono">
                      {item.entryType === "debit" ? formatAmount(item.amount) : "—"}
                    </td>
                    <td className="p-3 text-right border-l border-border font-mono text-destructive">
                      {item.entryType === "credit" ? formatAmount(item.amount) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6" colSpan={4}>Grand Total</td>
                <td className="p-3 text-right border-l border-border font-mono text-base">
                  {totalDebit > 0 ? formatAmount(totalDebit) : "—"}
                </td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-destructive">
                  {totalCredit > 0 ? formatAmount(totalCredit) : "—"}
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
            You have hidden <strong>{removedLines.length}</strong> transactions from this view.
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

export default function GroupVouchersClient(props: GroupVouchersClientProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Group Vouchers...</div>}>
      <GroupVouchersContent {...props} />
    </Suspense>
  );
}
