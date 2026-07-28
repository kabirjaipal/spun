"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { getVoucherRedirectUrl } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LedgerItem {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  referenceId: number | null;
  creditDays: number;
  debit: number;
  credit: number;
}

interface Voucher {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  partyId: number | null;
  netAmount: string;
  billDetails?: any;
  parentVoucherId?: number | null;
  createdBy?: string | null;
  createdByName?: string | null;
  remarks?: string | null;
}

interface GroupInfo {
  groupId: number;
  groupName: string;
  parentGroupId?: number | null;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface GroupOutstandingsClientProps {
  company: Company;
  groups: GroupInfo[];
  selectedGroup: GroupInfo | null;
  ledgers: LedgerItem[];
  vouchers: Voucher[];
  canExport: boolean;
}

function GroupOutstandingsContent({
  company,
  groups,
  selectedGroup,
  ledgers,
  vouchers,
  canExport,
}: GroupOutstandingsClientProps) {
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
  const [minOverdue, setMinOverdue] = useState("");
  const [maxOverdue, setMaxOverdue] = useState("");
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const ledgerIdParam = searchParams.get("ledgerId");
  const monthParam = searchParams.get("month");

  // Resolve pending bills for a specific ledger
  const getLedgerPendingBills = (l: LedgerItem) => {
    const isCustomer = l.ledgerType === "customer";
    const defaultType: "Dr" | "Cr" = isCustomer ? "Dr" : "Cr";
    const targetType = isCustomer ? "sale" : "purchase";

    const selectedVouchers = vouchers.filter((v) => 
      Number(v.partyId) === l.ledgerId || 
      (l.referenceId && Number(v.partyId) === Number(l.referenceId))
    );

    const invoices = selectedVouchers.filter((v) => v.voucherType === targetType);
    const adjustments = selectedVouchers.filter((v) => v.voucherType !== targetType);

    const linkedAdjustmentAmounts: Record<number, number> = {};
    const pendingBills: any[] = [];

    invoices.forEach((inv) => {
      const billing = Number(inv.netAmount) || 0;
      let paymentsSum = 0;
      let debitNotesSum = 0;
      let creditNotesSum = 0;

      adjustments.forEach((adj) => {
        if (adj.remarks?.includes("[RETURN CHEQUE REVERSAL]")) {
          return;
        }
        // 1. billDetails link
        if (adj.billDetails && Array.isArray(adj.billDetails)) {
          adj.billDetails.forEach((item: any) => {
            if (item && typeof item === "object" && Number(item.voucherId) === inv.voucherId) {
              const amt = Number(item.amount) || 0;
              linkedAdjustmentAmounts[adj.voucherId] = (linkedAdjustmentAmounts[adj.voucherId] || 0) + amt;
              if (adj.voucherType === "payment" || adj.voucherType === "receipt") {
                paymentsSum += amt;
              } else if (adj.voucherType === "debit_note") {
                debitNotesSum += amt;
              } else if (adj.voucherType === "credit_note") {
                creditNotesSum += amt;
              } else {
                paymentsSum += amt;
              }
            }
          });
        }

        // 2. parentVoucherId link
        if (adj.parentVoucherId && Number(adj.parentVoucherId) === inv.voucherId) {
          const amt = Number(adj.netAmount) || 0;
          linkedAdjustmentAmounts[adj.voucherId] = (linkedAdjustmentAmounts[adj.voucherId] || 0) + amt;
          if (adj.voucherType === "debit_note") {
            debitNotesSum += amt;
          } else if (adj.voucherType === "credit_note") {
            creditNotesSum += amt;
          } else if (adj.voucherType === "payment" || adj.voucherType === "receipt") {
            paymentsSum += amt;
          } else {
            paymentsSum += amt;
          }
        }
      });

      let paid = 0;
      if (!isCustomer) {
        paid = paymentsSum - debitNotesSum;
      } else {
        paid = paymentsSum + creditNotesSum;
      }

      const pending = billing - paid;
      if (Math.abs(pending) > 0.01) {
        const creditDays = l.creditDays || 10;
        const invDate = new Date(inv.voucherDate);
        const dueDate = new Date(invDate);
        dueDate.setDate(dueDate.getDate() + creditDays);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));

        pendingBills.push({
          voucherId: inv.voucherId,
          voucherType: inv.voucherType,
          date: inv.voucherDate,
          refNo: inv.voucherNo,
          billingAmount: billing,
          paidAmount: paid,
          pendingAmount: pending,
          dueDate: dueDate.toISOString().split("T")[0],
          overdueDays,
          createdBy: inv.createdByName || inv.createdBy || "System",
          type: defaultType,
        });
      }
    });

    adjustments.forEach((adj) => {
      const adjAmt = Number(adj.netAmount) || 0;
      const linked = linkedAdjustmentAmounts[adj.voucherId] || 0;
      const unlinked = adjAmt - linked;
      if (unlinked > 0.01) {
        pendingBills.push({
          voucherId: adj.voucherId,
          voucherType: adj.voucherType,
          date: adj.voucherDate,
          refNo: `${adj.voucherType.replace(/_/g, " ").toUpperCase()} (On Account)`,
          billingAmount: unlinked,
          paidAmount: 0,
          pendingAmount: unlinked,
          dueDate: "—",
          overdueDays: 0,
          createdBy: adj.createdByName || adj.createdBy || "System",
          type: defaultType === "Dr" ? "Cr" : "Dr",
        });
      }
    });

    return pendingBills;
  };

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

  // Filter out ledgers with zero net balance
  const activeLedgers = ledgers.filter(
    (l) => Math.abs(l.debit - l.credit) > 0.009
  );

  // Search filtering
  const searchedLedgers = activeLedgers.filter((l) =>
    l.ledgerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Omission filtering
  const visibleLedgers = searchedLedgers.filter(
    (l) => !removedLines.includes(String(l.ledgerId))
  );

  // Process ledgers: calculate pending bills and filter by overdue days
  const ledgersWithDetails = visibleLedgers.map((l) => {
    const allBills = getLedgerPendingBills(l);
    // Filter bills by overdue filter
    const filteredBills = allBills.filter((b) => {
      const minMatch = minOverdue === "" || b.overdueDays >= Number(minOverdue);
      const maxMatch = maxOverdue === "" || b.overdueDays <= Number(maxOverdue);
      return minMatch && maxMatch;
    });
    
    // Recalculate debit/credit sums based on filtered pending bills
    let debit = 0;
    let credit = 0;
    filteredBills.forEach((b) => {
      if (b.type === "Dr") debit += b.pendingAmount;
      else credit += b.pendingAmount;
    });

    // Group bills by month
    const monthlyGroups: Record<string, { monthName: string; monthKey: string; debit: number; credit: number; bills: any[] }> = {};
    filteredBills.forEach((bill: any) => {
      const dateObj = new Date(bill.date);
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      const monthName = dateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = {
          monthKey,
          monthName,
          debit: 0,
          credit: 0,
          bills: [],
        };
      }
      
      if (bill.type === "Dr") monthlyGroups[monthKey].debit += bill.pendingAmount;
      else monthlyGroups[monthKey].credit += bill.pendingAmount;
      
      monthlyGroups[monthKey].bills.push(bill);
    });

    const monthlyBills = Object.values(monthlyGroups).sort((a, b) => a.monthKey.slice(0, 7).localeCompare(b.monthKey.slice(0, 7)));

    return {
      ...l,
      debit,
      credit,
      bills: filteredBills,
      monthlyBills,
    };
  });

  // Filter out ledgers that have no net balance after overdue filtering
  const ledgersToDisplay = ledgersWithDetails.filter(
    (l) => l.debit > 0 || l.credit > 0
  );

  const currentLedger = ledgerIdParam ? ledgersToDisplay.find(x => x.ledgerId === Number(ledgerIdParam)) : null;
  const currentMonth = (currentLedger && monthParam) ? currentLedger.monthlyBills.find(x => x.monthKey === monthParam) : null;

  // Calculate totals of visible rows
  const totalDebit = currentLedger 
    ? (currentMonth ? currentMonth.bills.filter((x: any) => x.type === "Dr").reduce((sum: number, x: any) => sum + x.pendingAmount, 0) : currentLedger.monthlyBills.reduce((sum: number, l: any) => sum + l.debit, 0)) 
    : ledgersToDisplay.reduce((sum: number, l: any) => sum + l.debit, 0);

  const totalCredit = currentLedger 
    ? (currentMonth ? currentMonth.bills.filter((x: any) => x.type === "Cr").reduce((sum: number, x: any) => sum + x.pendingAmount, 0) : currentLedger.monthlyBills.reduce((sum: number, l: any) => sum + l.credit, 0)) 
    : ledgersToDisplay.reduce((sum: number, l: any) => sum + l.credit, 0);

  const netPending = Math.abs(totalDebit - totalCredit);
  const netPendingType = totalDebit >= totalCredit ? "Dr" : "Cr";

  const triggerPrint = () => {
    window.print();
  };

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
          <h1 className="text-lg font-bold text-foreground">
            Group Outstandings: <span className="text-primary font-extrabold">{selectedGroup.groupName}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Group Switcher Dropdown */}
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

          {/* Custom Overdue Days Range */}
          <div className="flex items-center gap-1.5 no-print">
            <Label htmlFor="min-overdue" className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">Min Days</Label>
            <Input
              id="min-overdue"
              type="number"
              placeholder="Min"
              value={minOverdue}
              onChange={(e) => setMinOverdue(e.target.value)}
              className="w-20 bg-background border-border h-10 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 no-print">
            <Label htmlFor="max-overdue" className="text-xs font-semibold uppercase text-muted-foreground whitespace-nowrap">Max Days</Label>
            <Input
              id="max-overdue"
              type="number"
              placeholder="Max"
              value={maxOverdue}
              onChange={(e) => setMaxOverdue(e.target.value)}
              className="w-20 bg-background border-border h-10 text-sm"
            />
          </div>

          {/* Search Input Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ledger..."
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

      {/* Breadcrumb / Back button */}
      {(ledgerIdParam || monthParam) && (
        <div className="flex items-center gap-2 mb-1 no-print">
          <Button
            variant="outline"
            className="h-9 px-3 text-sm font-semibold"
            onClick={() => {
              if (monthParam) {
                router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}&ledgerId=${ledgerIdParam}`);
              } else {
                router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}`);
              }
            }}
          >
            ← Back
          </Button>
          <div className="text-xs text-muted-foreground font-medium">
            <span 
              className="hover:underline cursor-pointer text-foreground" 
              onClick={() => router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}`)}
            >
              {selectedGroup.groupName}
            </span>
            {ledgerIdParam && (
              <>
                {" / "}
                <span 
                  className={`font-semibold text-foreground ${monthParam ? "hover:underline cursor-pointer" : ""}`}
                  onClick={() => {
                    if (monthParam) {
                      router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}&ledgerId=${ledgerIdParam}`);
                    }
                  }}
                >
                  {currentLedger?.ledgerName || "Ledger"}
                </span>
              </>
            )}
            {monthParam && (
              <>
                {" / "}
                <span className="font-semibold text-foreground">
                  {currentMonth?.monthName || "Month"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Report Table Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Printable Document Title Block */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Group Outstandings ({selectedGroup.groupName})
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
              {(!currentLedger || !currentMonth) ? (
                <>
                  <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3 text-left pl-6 min-w-[240px]" rowSpan={2}>
                      {!currentLedger ? "Particulars" : "Month"}
                    </th>
                    <th className="p-2 text-center border-l border-border" colSpan={2}>
                      Pending Bills
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3 text-right border-l border-border w-[180px]">Debit</th>
                    <th className="p-3 text-right border-l border-border w-[180px]">Credit</th>
                  </tr>
                </>
              ) : (
                <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 text-left pl-6">Date</th>
                  <th className="p-3 text-left">Ref No</th>
                  <th className="p-3 text-right">Billing Amt</th>
                  <th className="p-3 text-right">Paid Amt</th>
                  <th className="p-3 text-right">Pending Amt</th>
                  <th className="p-3 text-left">Due Date</th>
                  <th className="p-3 text-right">Overdue</th>
                  <th className="p-3 text-left">Who Did</th>
                </tr>
              )}
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-border/40 text-foreground">
              {/* Level 1: Ledger List */}
              {!currentLedger && (
                ledgersToDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-xs text-muted-foreground italic">
                      No outstanding ledger balances found for this group/period
                    </td>
                  </tr>
                ) : (
                  ledgersToDisplay.map((l) => (
                    <tr
                      key={l.ledgerId}
                      className="group/row hover:bg-muted/10 transition-colors font-medium cursor-pointer"
                      onClick={() => {
                        router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}&ledgerId=${l.ledgerId}`);
                      }}
                    >
                      <td className="p-3 pl-6 font-semibold">
                        <div className="flex items-center justify-between w-full">
                          <span className="hover:underline hover:text-primary">{l.ledgerName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveLine(String(l.ledgerId));
                            }}
                            className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                          >
                            Omit
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-right border-l border-border font-mono">
                        {formatAmount(l.debit)}
                      </td>
                      <td className="p-3 text-right border-l border-border font-mono font-bold text-foreground">
                        {formatAmount(l.credit)}
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* Level 2: Month Summary for Selected Ledger */}
              {currentLedger && !currentMonth && (
                currentLedger.monthlyBills.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-xs text-muted-foreground italic">
                      No monthly outstanding balances found for this ledger
                    </td>
                  </tr>
                ) : (
                  currentLedger.monthlyBills.map((month: any) => (
                    <tr
                      key={month.monthKey}
                      className="hover:bg-muted/10 transition-colors cursor-pointer font-medium"
                      onClick={() => {
                        router.push(`?from=${fromParam}&to=${toParam}&groupId=${selectedGroup.groupId}&ledgerId=${currentLedger.ledgerId}&month=${month.monthKey}`);
                      }}
                    >
                      <td className="p-3 pl-6 font-semibold">
                        <span className="hover:underline hover:text-primary">{month.monthName}</span>
                      </td>
                      <td className="p-3 text-right border-l border-border font-mono">
                        {formatAmount(month.debit)}
                      </td>
                      <td className="p-3 text-right border-l border-border font-mono font-bold text-foreground">
                        {formatAmount(month.credit)}
                      </td>
                    </tr>
                  ))
                )
              )}

              {/* Level 3: Pending Bills Breakdown for Selected Ledger & Month */}
              {currentLedger && currentMonth && (
                currentMonth.bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-muted-foreground italic">
                      No pending bills found for this month
                    </td>
                  </tr>
                ) : (
                  currentMonth.bills.map((bill: any, idx: number) => (
                    <tr
                      key={idx}
                      className="border-b border-border/40 hover:bg-muted/10 cursor-pointer"
                      onClick={() => {
                        if (bill.voucherId && bill.voucherType) {
                          router.push(getVoucherRedirectUrl(bill.voucherType, bill.voucherId));
                        }
                      }}
                    >
                      <td className="p-3 pl-6 font-mono">{formatDateToTally(bill.date)}</td>
                      <td className="p-3 font-semibold">{bill.refNo}</td>
                      <td className="p-3 text-right font-mono">{formatAmount(bill.billingAmount)}</td>
                      <td className="p-3 text-right font-mono">{formatAmount(bill.paidAmount)}</td>
                      <td className="p-3 text-right font-mono font-bold">{formatAmount(bill.pendingAmount)} {bill.type}</td>
                      <td className="p-3 font-mono">{bill.dueDate}</td>
                      <td className="p-3 text-right font-sans font-semibold text-destructive">
                        {bill.overdueDays > 0 ? `${bill.overdueDays} days` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{bill.createdBy}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot>
              {(!currentLedger || !currentMonth) ? (
                <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                  <td className="p-3 pl-6">Grand Total</td>
                  <td className="p-3 text-right border-l border-border font-mono text-base">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="p-3 text-right border-l border-border font-mono text-base">
                    {formatAmount(totalCredit)}
                  </td>
                </tr>
              ) : (
                <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                  <td colSpan={2} className="p-3 pl-6">Grand Total</td>
                  <td className="p-3 text-right font-mono">
                    {formatAmount(currentMonth.bills.reduce((sum: number, b: any) => sum + b.billingAmount, 0))}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {formatAmount(currentMonth.bills.reduce((sum: number, b: any) => sum + b.paidAmount, 0))}
                  </td>
                  <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">
                    {netPending > 0.01 ? `${formatAmount(netPending)} ${netPendingType}` : "—"}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Omitted Rows Warning Alert (Hidden on print) */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> ledger records from the outstandings display.
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

export default function GroupOutstandingsClient(props: GroupOutstandingsClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Outstandings</span></div>}>
      <GroupOutstandingsContent {...props} />
    </Suspense>
  );
}
