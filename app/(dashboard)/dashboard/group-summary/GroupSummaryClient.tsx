"use client";

import React, { useState, Suspense } from "react";
import { Download, Calendar, Search, Folder, BookOpen, ChevronRight, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GroupSummaryItem {
  id: string;
  groupId?: number;
  ledgerId?: number;
  name: string;
  type: "group" | "ledger";
  openingBalance: number;
  debitPeriod: number;
  creditPeriod: number;
  closingBalance: number;
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

interface GroupSummaryClientProps {
  company: Company;
  groups: GroupInfo[];
  selectedGroup: GroupInfo | null;
  reportItems: GroupSummaryItem[];
  canExport: boolean;
}

function GroupSummaryContent({
  company,
  groups,
  selectedGroup,
  reportItems,
  canExport,
}: GroupSummaryClientProps) {
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

  // Group selection search
  const [groupSearch, setGroupSearch] = useState("");

  // Omission lists
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

  // Filter out omitted items
  const activeItems = reportItems.filter((i) => !removedLines.includes(i.name));

  // Compute Grand Totals
  const totalOpenDebit = activeItems.reduce(
    (sum, i) => sum + (i.openingBalance >= 0 ? i.openingBalance : 0),
    0
  );
  const totalOpenCredit = activeItems.reduce(
    (sum, i) => sum + (i.openingBalance < 0 ? Math.abs(i.openingBalance) : 0),
    0
  );
  const totalPeriodDebit = activeItems.reduce((sum, i) => sum + i.debitPeriod, 0);
  const totalPeriodCredit = activeItems.reduce((sum, i) => sum + i.creditPeriod, 0);
  const totalCloseDebit = activeItems.reduce(
    (sum, i) => sum + (i.closingBalance >= 0 ? i.closingBalance : 0),
    0
  );
  const totalCloseCredit = activeItems.reduce(
    (sum, i) => sum + (i.closingBalance < 0 ? Math.abs(i.closingBalance) : 0),
    0
  );

  // Filter groups in selector
  const filteredGroups = groups
    .filter((g) => g.groupName.toLowerCase().includes(groupSearch.toLowerCase()))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));

  // 1. Group Selector View (If no group selected)
  if (!selectedGroup) {
    return (
      <div className="max-w-md mx-auto my-12 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="bg-muted/40 p-4 border-b border-border">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground text-center">
            Select Name of Group
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search group name..."
              value={groupSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGroupSearch(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border border border-border rounded-md">
            {filteredGroups.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                No matching groups found
              </div>
            ) : (
              filteredGroups.map((g) => (
                <button
                  key={g.groupId}
                  onClick={() => handleGroupSelect(g.groupId)}
                  className="w-full text-left p-2.5 px-4 text-sm font-medium hover:bg-secondary/40 flex justify-between items-center group transition-colors"
                >
                  <span className="text-foreground group-hover:text-primary">{g.groupName}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const triggerPrint = () => {
    window.print();
  };

  // 2. Group Summary Report View
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">
            Group Summary: <span className="text-primary font-extrabold">{selectedGroup.groupName}</span>
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
            Group Summary Report ({selectedGroup.groupName})
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Working Capital & Funds Flow Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Column Headers */}
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[240px]" rowSpan={2}>
                  Particulars
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Opening Balance
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Transactions
                </th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>
                  Closing Balance
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Debit</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Credit</th>
              </tr>
            </thead>

            {/* Table Body - Monthly Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {activeItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground italic">
                    No subgroups or ledgers found under this category
                  </td>
                </tr>
              ) : (
                activeItems.map((item) => {
                  const isGrp = item.type === "group";

                  return (
                    <tr
                      key={item.id}
                      className="group/row hover:bg-muted/10 transition-colors"
                    >
                      <td className="p-3 pl-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isGrp ? (
                              <Folder className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            {isGrp ? (
                              <Link
                                href={`?from=${fromParam}&to=${toParam}&groupId=${item.groupId}`}
                                className="font-bold text-foreground hover:underline hover:text-primary truncate"
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <Link
                                href={`/dashboard/ledger-report?ledgerId=${item.ledgerId}&from=${fromParam}&to=${toParam}`}
                                className="italic text-foreground/90 hover:underline truncate"
                              >
                                {item.name}
                              </Link>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveLine(item.name)}
                            className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal shrink-0"
                          >
                            Omit
                          </button>
                        </div>
                      </td>
                      {/* Opening Balance */}
                      <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                        {item.openingBalance >= 0 ? formatAmount(item.openingBalance) : "—"}
                      </td>
                      <td className="p-2 text-right border-l border-border font-mono text-destructive">
                        {item.openingBalance < 0 ? formatAmount(item.openingBalance) : "—"}
                      </td>
                      {/* Transactions */}
                      <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                        {item.debitPeriod > 0 ? formatAmount(item.debitPeriod) : "—"}
                      </td>
                      <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">
                        {item.creditPeriod > 0 ? formatAmount(item.creditPeriod) : "—"}
                      </td>
                      {/* Closing Balance */}
                      <td className="p-2 text-right border-l border-border font-mono font-semibold">
                        {item.closingBalance >= 0 ? formatAmount(item.closingBalance) : "—"}
                      </td>
                      <td className="p-2 text-right border-l border-border font-mono font-semibold text-destructive">
                        {item.closingBalance < 0 ? formatAmount(item.closingBalance) : "—"}
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
                  {totalOpenDebit > 0 ? formatAmount(totalOpenDebit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-destructive">
                  {totalOpenCredit > 0 ? formatAmount(totalOpenCredit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono">
                  {totalPeriodDebit > 0 ? formatAmount(totalPeriodDebit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono">
                  {totalPeriodCredit > 0 ? formatAmount(totalPeriodCredit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-base">
                  {totalCloseDebit > 0 ? formatAmount(totalCloseDebit) : "—"}
                </td>
                <td className="p-2 text-right border-l border-border font-mono text-base text-destructive">
                  {totalCloseCredit > 0 ? formatAmount(totalCloseCredit) : "—"}
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
            You have hidden <strong>{removedLines.length}</strong> items from this view.
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

export default function GroupSummaryClient(props: GroupSummaryClientProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Group Summary...</div>}>
      <GroupSummaryContent {...props} />
    </Suspense>
  );
}
