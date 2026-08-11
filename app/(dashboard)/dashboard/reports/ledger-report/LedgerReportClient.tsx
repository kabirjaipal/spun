"use client";

import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, ArrowLeft, Search, BookOpen, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { getVoucherRedirectUrl } from "@/lib/utils";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  referenceId: number | null;
  debit: number;
  credit: number;
  activityCount: number;
  lastPosted: string | null;
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
  remarks?: string | null;
}

interface LedgerEntry {
  entryId: number;
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  entryType: "debit" | "credit";
  amount: number;
  particulars: string;
}

interface LedgerReportClientProps {
  company: Company;
  ledgers: Ledger[];
  selectedLedger: Ledger | null;
  vouchers: Voucher[];
  ledgerEntries: LedgerEntry[];
  openingBalance: number;
  canExport: boolean;
}

interface PendingBill {
  date: string;
  refNo: string;
  openingAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueOn: string;
  overdueDays: number;
  type: "Dr" | "Cr";
  voucherId?: number;
  voucherType?: string;
  payments?: {
    voucherNo: string;
    voucherType: string;
    voucherDate: string;
    amount: number;
  }[];
}

function LedgerReportContent({
  company,
  ledgers,
  selectedLedger,
  vouchers,
  ledgerEntries,
  openingBalance,
  canExport,
}: LedgerReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dynamic current FY defaults (April start)
  const fyStartYear = (() => { const m = new Date().getMonth(); const y = new Date().getFullYear(); return m >= 3 ? y : y - 1; })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const [monthlyView, setMonthlyView] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<any | null>(null);

  const isPartyLedger = selectedLedger &&
    (selectedLedger.ledgerType === "customer" || selectedLedger.ledgerType === "company");
  const [viewMode, setViewMode] = useState<"vouchers" | "outstandings">("vouchers");
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<PendingBill | null>(null);

  const monthlySummary = useMemo(() => {
    if (!selectedLedger) return [];

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    const monthsList: { key: string; monthName: string; year: number }[] = [];
    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

    while (curr <= endLimit) {
      const monthName = curr.toLocaleDateString("en-IN", { month: "long" });
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`;
      monthsList.push({ key, monthName, year: curr.getFullYear() });
      curr.setMonth(curr.getMonth() + 1);
    }

    let runningBalance = openingBalance;
    return monthsList.map((month) => {
      const monthEntries = ledgerEntries.filter(
        (e) => e.voucherDate.slice(0, 7) === month.key
      );

      const debit = monthEntries
        .filter((e) => e.entryType === "debit")
        .reduce((sum, e) => sum + e.amount, 0);

      const credit = monthEntries
        .filter((e) => e.entryType === "credit")
        .reduce((sum, e) => sum + e.amount, 0);

      runningBalance += (debit - credit);

      return {
        monthKey: month.key,
        monthName: month.monthName,
        year: month.year,
        debit,
        credit,
        closingBalance: runningBalance,
        entries: monthEntries,
      };
    });
  }, [startDate, endDate, ledgerEntries, openingBalance, selectedLedger]);

  const selectedMonthOpeningBalance = useMemo(() => {
    if (!selectedMonth) return 0;
    return selectedMonth.closingBalance - (selectedMonth.debit - selectedMonth.credit);
  }, [selectedMonth]);

  const selectedMonthVoucherRows = useMemo(() => {
    if (!selectedMonth) return [];
    let runningSum = selectedMonthOpeningBalance;
    return selectedMonth.entries.map((e: any) => {
      runningSum += e.entryType === "debit" ? e.amount : -e.amount;
      return { ...e, balance: runningSum };
    });
  }, [selectedMonth, selectedMonthOpeningBalance]);

  const findLedgerByName = (name: string) => {
    return ledgers.find((l) => l.ledgerName === name);
  };

  const renderParticulars = (name: string) => {
    const ledger = findLedgerByName(name);
    if (ledger) {
      return (
        <a
          href={`/dashboard/reports/ledger-report?ledgerId=${ledger.ledgerId}`}
          className="text-primary hover:underline font-semibold"
        >
          {name}
        </a>
      );
    }
    if (name.endsWith(" & others")) {
      const baseName = name.replace(" & others", "");
      const baseLedger = findLedgerByName(baseName);
      if (baseLedger) {
        return (
          <span>
            <a
              href={`/dashboard/reports/ledger-report?ledgerId=${baseLedger.ledgerId}`}
              className="text-primary hover:underline font-semibold"
            >
              {baseName}
            </a>
            <span className="text-muted-foreground font-normal"> & others</span>
          </span>
        );
      }
    }
    return <span>{name}</span>;
  };

  const [ledgerSearch, setLedgerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatAmount = (val: number, type?: "Dr" | "Cr") => {
    if (val === 0) return "—";
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(val));
    return type ? `${formatted} ${type}` : formatted;
  };

  const fmtDate = (d: string, short = false) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: short ? "2-digit" : "numeric",
    });

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    const lid = searchParams.get("ledgerId");
    const base = lid ? `?ledgerId=${lid}&` : "?";
    router.push(`${base}from=${startDate}&to=${endDate}`);
  };

  const handleSelectLedger = (ledgerId: number) => {
    setShowDropdown(false);
    setLedgerSearch("");
    router.push(`?ledgerId=${ledgerId}&from=${fromParam}&to=${toParam}`);
  };  // ─── Outstandings Calculation ────────────────────────────────────────────────
  const calculateOutstandings = (): PendingBill[] => {
    if (!selectedLedger || !isPartyLedger) return [];

    const isCustomer = selectedLedger.ledgerType === "customer";
    const defaultType: "Dr" | "Cr" = isCustomer ? "Dr" : "Cr";
    const targetType = isCustomer ? "sale" : "purchase";

    const invoices = vouchers.filter((v) => v.voucherType === targetType);
    const adjustments = vouchers.filter((v) => v.voucherType !== targetType);

    const linkedAdjustmentAmounts: Record<number, number> = {};

    const pendingBills: PendingBill[] = [];

    invoices.forEach((inv) => {
      const billing = Number(inv.netAmount) || 0;
      let paymentsSum = 0;
      let debitNotesSum = 0;
      let creditNotesSum = 0;
      let salesReturnsSum = 0;
      let purchaseReturnsSum = 0;
      const paymentsList: { voucherId: number; voucherNo: string; voucherType: string; voucherDate: string; amount: number }[] = [];

      adjustments.forEach((adj) => {
        if (adj.remarks?.includes("[RETURN CHEQUE REVERSAL]")) {
          return;
        }
        
        let linkAmt = 0;
        // 1. Check billDetails (payment/receipt links)
        if (adj.billDetails && Array.isArray(adj.billDetails)) {
          adj.billDetails.forEach((item: any) => {
            if (item && typeof item === "object" && Number(item.voucherId) === inv.voucherId) {
              linkAmt += Number(item.amount) || 0;
            }
          });
        }

        // 2. Check parentVoucherId (debit_note/credit_note links)
        if (linkAmt === 0 && adj.parentVoucherId && Number(adj.parentVoucherId) === inv.voucherId) {
          linkAmt += Number(adj.netAmount) || 0;
        }

        if (linkAmt > 0) {
          linkedAdjustmentAmounts[adj.voucherId] = (linkedAdjustmentAmounts[adj.voucherId] || 0) + linkAmt;
          paymentsList.push({
            voucherId: adj.voucherId,
            voucherNo: adj.voucherNo,
            voucherType: adj.voucherType,
            voucherDate: adj.voucherDate,
            amount: linkAmt,
          });

          if (adj.voucherType === "payment" || adj.voucherType === "receipt") {
            paymentsSum += linkAmt;
          } else if (adj.voucherType === "debit_note") {
            debitNotesSum += linkAmt;
          } else if (adj.voucherType === "credit_note") {
            creditNotesSum += linkAmt;
          } else if (adj.voucherType === "sales_return") {
            salesReturnsSum += linkAmt;
          } else if (adj.voucherType === "purchase_return") {
            purchaseReturnsSum += linkAmt;
          } else {
            paymentsSum += linkAmt;
          }
        }
      });

      let paid = 0;
      if (!isCustomer) {
        // Purchase (vendor)
        paid = paymentsSum + debitNotesSum + purchaseReturnsSum - creditNotesSum;
      } else {
        // Sales (customer)
        paid = paymentsSum + creditNotesSum + salesReturnsSum - debitNotesSum;
      }

      const pending = billing - paid;
      if (Math.abs(pending) > 0.01) {
        const creditDays = 10;
        const invDate = new Date(inv.voucherDate);
        const dueDate = new Date(invDate);
        dueDate.setDate(dueDate.getDate() + creditDays);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdueDays = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
        pendingBills.push({
          date: inv.voucherDate,
          refNo: inv.voucherNo,
          openingAmount: billing,
          paidAmount: paid,
          pendingAmount: Math.abs(pending),
          dueOn: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
          overdueDays,
          type: pending >= 0 ? defaultType : (defaultType === "Dr" ? "Cr" : "Dr"),
          voucherId: inv.voucherId,
          voucherType: inv.voucherType,
          payments: paymentsList,
        });
      }
    });

    adjustments.forEach((adj) => {
      const adjAmt = Number(adj.netAmount) || 0;
      const linked = linkedAdjustmentAmounts[adj.voucherId] || 0;
      const unlinked = adjAmt - linked;
      if (unlinked > 0.01) {
        pendingBills.push({
          date: adj.voucherDate,
          refNo: `${adj.voucherType.replace(/_/g, " ").toUpperCase()} (On Account)`,
          openingAmount: unlinked,
          paidAmount: 0,
          pendingAmount: unlinked,
          dueOn: "—",
          overdueDays: 0,
          type: defaultType === "Dr" ? "Cr" : "Dr",
          voucherId: adj.voucherId,
          voucherType: adj.voucherType,
        });
      }
    });

    return pendingBills;
  };

  const pendingBills = calculateOutstandings();
  const totalOpening = pendingBills.reduce((s, b) => s + b.openingAmount, 0);
  const totalPaid = pendingBills.reduce((s, b) => s + b.paidAmount, 0);
  const totalPending = pendingBills.reduce((s, b) => s + b.pendingAmount, 0);

  // ─── Running Balance ─────────────────────────────────────────────────────────
  let runningSum = openingBalance;
  const ledgerVoucherRows = ledgerEntries.map((e) => {
    runningSum += e.entryType === "debit" ? e.amount : -e.amount;
    return { ...e, balance: runningSum };
  });

  const totalDebits = ledgerEntries.reduce((s, e) => s + (e.entryType === "debit" ? e.amount : 0), 0);
  const totalCredits = ledgerEntries.reduce((s, e) => s + (e.entryType === "credit" ? e.amount : 0), 0);

  const filteredLedgers = ledgers.filter((l) =>
    l.ledgerName.toLowerCase().includes(ledgerSearch.toLowerCase())
  );

  // ─── Shared print header ─────────────────────────────────────────────────────
  const PrintHeader = ({ reportTitle, subTitle }: { reportTitle: string; subTitle: string }) => (
    <div className="hidden print:block text-center py-5 border-b border-border bg-card">
      <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
        {company.companyName}
      </h1>
      {company.address && (
        <p className="text-xs text-muted-foreground mt-0.5">{company.address}</p>
      )}
      {company.gstNo && (
        <p className="text-xs text-muted-foreground">GSTIN: {company.gstNo}</p>
      )}
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-2">
        {reportTitle}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{subTitle}</p>
    </div>
  );

  return (
    <div className="space-y-6 select-none relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          aside, header, nav, button, .no-print, [role="dialog"] {
            display: none !important;
          }
          html, body, #__next, main {
            background: white !important; color: black !important;
            overflow: visible !important; height: auto !important;
            min-height: 0 !important; margin: 0 !important;
            padding: 0 !important; position: static !important;
            border: none !important; box-shadow: none !important;
          }
          .print-area {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            padding: 1rem !important; box-sizing: border-box !important;
            background: white !important; z-index: 99999 !important;
          }
          @page { size: A4; margin: 0mm; }
        }
      `}} />

      {/* Top Controls — hidden during print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          {selectedLedger && (
            <Button variant="outline" size="icon" onClick={() => router.push(`?from=${fromParam}&to=${toParam}`)} className="h-10 w-10 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Ledger Report</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedLedger
                ? `Account statement for ${selectedLedger.ledgerName}`
                : "Select a ledger to view its account statement."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Ledger Search Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Select Ledger..."
                value={ledgerSearch}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => { setLedgerSearch(e.target.value); setShowDropdown(true); }}
                className="pl-9 h-10 w-60 text-sm bg-background border-input"
              />
            </div>
            {showDropdown && (
              <div className="absolute right-0 top-11 z-50 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1">
                <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 border-b border-border bg-muted/30 flex justify-between items-center">
                  <span>List of Ledgers</span>
                  <span className="font-mono font-normal text-foreground/50">{filteredLedgers.length}</span>
                </div>
                {filteredLedgers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">No ledgers found.</div>
                ) : (
                  filteredLedgers.map((l) => (
                    <button
                      key={l.ledgerId}
                      onClick={() => handleSelectLedger(l.ledgerId)}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between border-b border-border/40"
                    >
                      <span className="font-semibold text-foreground truncate">{l.ledgerName}</span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {l.ledgerType}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedLedger && viewMode === "vouchers" && (
            <Button
              variant="outline"
              onClick={() => setMonthlyView(!monthlyView)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {monthlyView ? "Detailed View" : "Monthly Summary"}
            </Button>
          )}

          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>
          <Button onClick={() => window.print()} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* View-mode tabs for party ledgers */}
      {selectedLedger && isPartyLedger && (
        <div className="flex border-b border-border gap-2 no-print">
          <button
            onClick={() => setViewMode("vouchers")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              viewMode === "vouchers" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Ledger Vouchers
          </button>
          <button
            onClick={() => setViewMode("outstandings")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
              viewMode === "outstandings" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ledger Outstandings
          </button>
        </div>
      )}

      {/* ─── REPORT VIEWS ──────────────────────────────────────────────────────── */}
      {selectedLedger ? (
        viewMode === "outstandings" && isPartyLedger ? (
          /* OUTSTANDINGS view */
          <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
            {/* Print-only header */}
            <PrintHeader
              reportTitle="Ledger Outstandings"
              subTitle={`${selectedLedger.ledgerName} — Pending Bills | ${fmtDate(startDate)} to ${fmtDate(endDate)}`}
            />

            {/* Screen header — hidden during print */}
            <div className="border-b border-border bg-muted/20 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">Ledger Outstandings</p>
                <h2 className="text-lg font-black text-foreground mt-0.5 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  {selectedLedger.ledgerName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Details of: <span className="text-foreground font-semibold">Pending Bills</span>
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold uppercase tracking-widest text-foreground">{company.companyName}</p>
                {company.gstNo && <p className="text-[10px] text-muted-foreground">GSTIN: {company.gstNo}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(startDate)} to {fmtDate(endDate)}</p>
              </div>
            </div>

            {/* Table */}
            {pendingBills.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground text-sm bg-muted/5">
                No outstanding pending bills found for this account in the selected period.
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-2 p-3.5 pl-4 border-r border-border">Date</div>
                  <div className="col-span-2 p-3.5 pl-4 border-r border-border">Ref. No.</div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border pr-4">Billing Amount</div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border pr-4">Paid Amount</div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border pr-4">Pending Amount</div>
                  <div className="col-span-1 p-3.5 border-r border-border pl-3">Due on</div>
                  <div className="col-span-1 p-3.5 text-right pr-4">Overdue</div>
                </div>

                {/* Data rows */}
                <div className="divide-y divide-border/40 font-mono text-sm">
                  {pendingBills.map((bill, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 hover:bg-muted/30 text-foreground transition-colors cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) {
                          return;
                        }
                        if (bill.voucherId && bill.voucherType) {
                          router.push(getVoucherRedirectUrl(bill.voucherType, bill.voucherId));
                        }
                      }}
                    >
                      <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-foreground/80 flex items-center text-xs">
                        {fmtDate(bill.date, true)}
                      </div>
                      <div className="col-span-2 p-3 pl-4 border-r border-border/50 font-sans font-semibold text-foreground flex items-center truncate">
                        {bill.refNo}
                      </div>
                      <div className="col-span-2 p-3 text-right border-r border-border/50 pr-4 flex items-center justify-end">
                        {formatAmount(bill.openingAmount, bill.type)}
                      </div>
                      <div 
                        className={`col-span-2 p-3 text-right border-r border-border/50 pr-4 flex items-center justify-end ${
                          bill.paidAmount > 0 
                            ? "cursor-pointer hover:underline text-primary" 
                            : ""
                        }`}
                        onClick={() => {
                          if (bill.paidAmount > 0) {
                            setSelectedBillForDetails(bill);
                          }
                        }}
                      >
                        {formatAmount(bill.paidAmount, bill.type)}
                      </div>
                      <div className="col-span-2 p-3 text-right border-r border-border/50 pr-4 flex items-center justify-end font-bold">
                        {formatAmount(bill.pendingAmount)}
                      </div>
                      <div className="col-span-1 p-3 border-r border-border/50 pl-3 font-sans text-xs text-foreground/80 flex items-center">
                        {bill.dueOn}
                      </div>
                      <div className="col-span-1 p-3 text-right pr-4 flex items-center justify-end font-sans text-xs font-semibold">
                        {bill.overdueDays > 0 ? bill.overdueDays : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="grid grid-cols-12 border-t-2 border-b-2 border-double border-border bg-muted/20 font-mono text-sm font-bold text-foreground">
                  <div className="col-span-4 p-3.5 pl-4 uppercase font-sans font-black">Total Pending</div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border/50 pr-4 font-black">
                    {formatAmount(Math.abs(totalOpening), totalOpening >= 0 ? "Dr" : "Cr")}
                  </div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border/50 pr-4 font-black">
                    {formatAmount(Math.abs(totalPaid), totalPaid >= 0 ? "Dr" : "Cr")}
                  </div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border/50 pr-4 font-black">
                    {formatAmount(Math.abs(totalPending))}
                  </div>
                  <div className="col-span-2 p-3.5" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* LEDGER VOUCHERS (Account Statement) view */
          <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
            {/* Print-only header */}
            <PrintHeader
              reportTitle={monthlyView ? "Ledger Monthly Summary" : "Ledger Vouchers"}
              subTitle={`${selectedLedger.ledgerName} | ${fmtDate(startDate)} to ${fmtDate(endDate)}`}
            />

            {/* Screen header */}
            <div className="border-b border-border bg-muted/20 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">
                  {monthlyView ? "Ledger Monthly Summary" : "Ledger Vouchers"}
                </p>
                <h2 className="text-lg font-black text-foreground mt-0.5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  {selectedLedger.ledgerName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type: <span className="text-foreground font-semibold uppercase">{selectedLedger.ledgerType}</span>
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold uppercase tracking-widest text-foreground">{company.companyName}</p>
                {company.gstNo && <p className="text-[10px] text-muted-foreground">GSTIN: {company.gstNo}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(startDate)} to {fmtDate(endDate)}</p>
              </div>
            </div>

            {monthlyView ? (
              /* MONTHLY SUMMARY TABLE */
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-4 p-3.5 pl-6 border-r border-border">Particulars (Month)</div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border pr-6">Debit</div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border pr-6">Credit</div>
                  <div className="col-span-2 p-3.5 text-right pr-6">Closing Balance</div>
                </div>

                {/* Opening Balance row */}
                <div className="grid grid-cols-12 bg-muted/10 text-foreground border-b border-border/30">
                  <div className="col-span-4 p-3 pl-6 border-r border-border/50 font-sans text-xs uppercase font-extrabold text-muted-foreground flex items-center">
                    Opening Balance
                  </div>
                  <div className="col-span-3 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-6 text-xs">—</div>
                  <div className="col-span-3 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-6 text-xs">—</div>
                  <div className="col-span-2 p-3 text-right pr-6 flex items-center justify-end font-mono font-bold text-sm">
                    {formatAmount(openingBalance, openingBalance >= 0 ? "Dr" : "Cr")}
                  </div>
                </div>

                {/* Month rows */}
                <div className="divide-y divide-border/40 text-foreground">
                  {monthlySummary.map((item) => (
                    <div
                      key={item.monthKey}
                      onClick={() => setSelectedMonth(item)}
                      className="grid grid-cols-12 hover:bg-muted/30 transition-colors font-mono text-sm cursor-pointer"
                    >
                      <div className="col-span-4 p-3 pl-6 border-r border-border/50 font-sans font-medium">
                        {item.monthName} {item.year}
                      </div>
                      <div className="col-span-3 p-3 text-right border-l border-r border-border/50 pr-6 font-mono text-foreground">{item.debit > 0 ? formatAmount(item.debit) : "—"}</div>
                      <div className="col-span-3 p-3 text-right border-r border-border/50 pr-6 font-mono text-foreground">{item.credit > 0 ? formatAmount(item.credit) : "—"}</div>
                      <div className="col-span-2 p-3 text-right pr-6 font-mono font-semibold">{formatAmount(Math.abs(item.closingBalance), item.closingBalance >= 0 ? "Dr" : "Cr")}</div>
                    </div>
                  ))}
                </div>

                {/* Grand Totals */}
                <div className="grid grid-cols-12 border-t-2 border-b-2 border-double border-border bg-muted/20 font-mono text-sm font-bold text-foreground">
                  <div className="col-span-4 p-3.5 pl-6 font-sans font-black">Grand Total</div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border/50 pr-6 font-black text-xs">
                    {formatAmount(totalDebits)}
                  </div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border/50 pr-6 font-black text-xs">
                    {formatAmount(totalCredits)}
                  </div>
                  <div className="col-span-2 p-3.5 text-right pr-6 font-black text-base">
                    {formatAmount(Math.abs(runningSum), runningSum >= 0 ? "Dr" : "Cr")}
                  </div>
                </div>
              </div>
            ) : (
              /* DETAILED VIEW TABLE */
              <div>
                {/* Column headers — 12 valid tailwind columns: 2+4+2+2+1+1=12 for date, particulars, vchtype, vchno, debit, credit, balance */}
                <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-2 p-3.5 pl-4 border-r border-border">Date</div>
                  <div className="col-span-4 p-3.5 pl-4 border-r border-border">Particulars</div>
                  <div className="col-span-2 p-3.5 pl-4 border-r border-border">Vch Type</div>
                  <div className="col-span-1 p-3.5 pl-4 border-r border-border">Vch No.</div>
                  <div className="col-span-1 p-3.5 text-right border-r border-border pr-3">Debit</div>
                  <div className="col-span-1 p-3.5 text-right border-r border-border pr-3">Credit</div>
                  <div className="col-span-1 p-3.5 text-right pr-3">Balance</div>
                </div>

                {/* Opening Balance row */}
                <div className="grid grid-cols-12 bg-muted/10 text-foreground border-b border-border/30">
                  <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                  <div className="col-span-4 p-3 pl-4 border-r border-border/50 font-sans text-xs uppercase font-extrabold text-muted-foreground flex items-center">
                    Opening Balance
                  </div>
                  <div className="col-span-2 p-3 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                  <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                  <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-3 text-xs">—</div>
                  <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-3 text-xs">—</div>
                  <div className="col-span-1 p-3 text-right pr-3 flex items-center justify-end font-mono font-bold text-sm">
                    {formatAmount(openingBalance, openingBalance >= 0 ? "Dr" : "Cr")}
                  </div>
                </div>

                {/* Transaction rows */}
                <div className="divide-y divide-border/40">
                  {ledgerVoucherRows.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm font-sans col-span-12">
                      No transactions recorded for the selected period.
                    </div>
                  ) : (
                    ledgerVoucherRows.map((e) => (
                      <div
                        key={e.entryId}
                        className="grid grid-cols-12 hover:bg-muted/30 transition-colors font-mono text-sm text-foreground cursor-pointer"
                        onClick={(eTarget) => {
                          if ((eTarget.target as HTMLElement).closest("button") || (eTarget.target as HTMLElement).closest("a")) {
                            return;
                          }
                          router.push(getVoucherRedirectUrl(e.voucherType, e.voucherId));
                        }}
                      >
                        <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-foreground/70 flex items-center text-xs font-sans">
                          {fmtDate(e.voucherDate, true)}
                        </div>
                        <div className="col-span-4 p-3 pl-4 border-r border-border/50 font-sans font-semibold text-foreground flex items-center truncate text-xs">
                          {renderParticulars(e.particulars)}
                        </div>
                        <div className="col-span-2 p-3 border-r border-border/50 font-sans text-xs uppercase font-bold text-muted-foreground flex items-center">
                          {e.voucherType.replace(/_/g, " ")}
                        </div>
                        <div className="col-span-1 p-3 border-r border-border/50 font-sans font-medium text-foreground flex items-center text-xs">
                          {e.voucherNo}
                        </div>
                        <div className="col-span-1 p-3 text-right border-r border-border/50 pr-3 flex items-center justify-end text-xs">
                          {e.entryType === "debit" ? formatAmount(e.amount) : "—"}
                        </div>
                        <div className="col-span-1 p-3 text-right border-r border-border/50 pr-3 flex items-center justify-end text-xs">
                          {e.entryType === "credit" ? formatAmount(e.amount) : "—"}
                        </div>
                        <div className="col-span-1 p-3 text-right pr-3 flex items-center justify-end font-semibold text-xs">
                          {formatAmount(e.balance, e.balance >= 0 ? "Dr" : "Cr")}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Current totals row */}
                <div className="grid grid-cols-12 border-t border-border bg-muted/10 font-mono text-sm font-bold text-foreground">
                  <div className="col-span-8 p-3.5 pl-4 uppercase font-sans font-black text-xs">Current Total</div>
                  <div className="col-span-1 p-3.5 text-right border-r border-border/50 pr-3 font-black text-xs">
                    {formatAmount(totalDebits)}
                  </div>
                  <div className="col-span-1 p-3.5 text-right border-r border-border/50 pr-3 font-black text-xs">
                    {formatAmount(totalCredits)}
                  </div>
                  <div className="col-span-2" />
                </div>

                {/* Closing balance row */}
                <div className="grid grid-cols-12 border-t-2 border-b-2 border-double border-border bg-muted/20 font-mono text-sm font-bold text-foreground">
                  <div className="col-span-8 p-3.5 pl-4 uppercase font-sans font-black text-xs">Closing Balance</div>
                  <div className="col-span-1 p-3.5 border-r border-border/50" />
                  <div className="col-span-1 p-3.5 border-r border-border/50" />
                  <div className="col-span-2 p-3.5 text-right pr-3 font-black text-base">
                    {formatAmount(runningSum, runningSum >= 0 ? "Dr" : "Cr")}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* SUMMARY LIST: All Ledgers */
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border bg-muted/20 px-6 py-5 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Ledger Balances Summary</h2>
            <span className="text-xs text-muted-foreground font-semibold">{ledgers.length} ledgers</span>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3.5">Ledger Name</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5 text-right">Debit</th>
                <th className="px-4 py-3.5 text-right">Credit</th>
                <th className="px-4 py-3.5 text-right">Entries</th>
                <th className="px-4 py-3.5 text-right pr-6">Last Posted</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No ledger postings found.
                  </td>
                </tr>
              ) : (
                ledgers.map((l) => (
                  <tr
                    key={l.ledgerId}
                    onClick={() => handleSelectLedger(l.ledgerId)}
                    className="border-t border-border/50 hover:bg-muted/10 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">{l.ledgerName}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">{l.ledgerType}</td>
                    <td className="px-4 py-3 text-right text-foreground font-mono">
                      {l.debit > 0 ? formatAmount(l.debit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-mono">
                      {l.credit > 0 ? formatAmount(l.credit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono">{l.activityCount}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground pr-6 font-mono">
                      {l.lastPosted ? fmtDate(l.lastPosted, true) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Period Dialog */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">From</Label>
              <Input id="from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="col-span-3 h-10 text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">To</Label>
              <Input id="to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="col-span-3 h-10 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
            <Button onClick={handleApplyPeriod}>Apply Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly Voucher Drill-down Listing Dialog */}
      <Dialog open={selectedMonth !== null} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Ledger Vouchers — {selectedMonth?.monthName} {selectedMonth?.year} ({selectedLedger?.ledgerName})
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              {/* Table headers */}
              <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-2 p-3.5 pl-4 border-r border-border">Date</div>
                <div className="col-span-4 p-3.5 pl-4 border-r border-border">Particulars</div>
                <div className="col-span-2 p-3.5 pl-4 border-r border-border">Vch Type</div>
                <div className="col-span-1 p-3.5 pl-4 border-r border-border">Vch No.</div>
                <div className="col-span-1 p-3.5 text-right border-r border-border pr-3">Debit</div>
                <div className="col-span-1 p-3.5 text-right border-r border-border pr-3">Credit</div>
                <div className="col-span-1 p-3.5 text-right pr-3">Balance</div>
              </div>

              {/* Opening Balance of selected month */}
              <div className="grid grid-cols-12 bg-muted/10 text-foreground border-b border-border/30">
                <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                <div className="col-span-4 p-3 pl-4 border-r border-border/50 font-sans text-xs uppercase font-extrabold text-muted-foreground flex items-center">
                  Opening Balance
                </div>
                <div className="col-span-2 p-3 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground flex items-center text-xs">—</div>
                <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-3 text-xs">—</div>
                <div className="col-span-1 p-3 border-r border-border/50 text-muted-foreground text-right flex items-center justify-end pr-3 text-xs">—</div>
                <div className="col-span-1 p-3 text-right pr-3 flex items-center justify-end font-mono font-bold text-sm">
                  {formatAmount(selectedMonthOpeningBalance, selectedMonthOpeningBalance >= 0 ? "Dr" : "Cr")}
                </div>
              </div>

              {/* Transaction rows of selected month */}
              <div className="divide-y divide-border/40">
                {selectedMonthVoucherRows.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm font-sans col-span-12">
                    No transactions recorded for this month.
                  </div>
                ) : (
                  selectedMonthVoucherRows.map((e: any) => (
                    <div key={e.entryId} className="grid grid-cols-12 hover:bg-muted/30 transition-colors font-mono text-sm text-foreground">
                      <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-foreground/70 flex items-center text-xs font-sans">
                        {fmtDate(e.voucherDate, true)}
                      </div>
                      <div className="col-span-4 p-3 pl-4 border-r border-border/50 font-sans font-semibold text-foreground flex items-center truncate text-xs">
                        {renderParticulars(e.particulars)}
                      </div>
                      <div className="col-span-2 p-3 border-r border-border/50 font-sans text-xs uppercase font-bold text-muted-foreground flex items-center">
                        {e.voucherType.replace(/_/g, " ")}
                      </div>
                      <div className="col-span-1 p-3 border-r border-border/50 font-sans font-medium text-foreground flex items-center text-xs">
                        {e.voucherNo}
                      </div>
                      <div className="col-span-1 p-3 text-right border-r border-border/50 pr-3 flex items-center justify-end text-xs">
                        {e.entryType === "debit" ? formatAmount(e.amount) : "—"}
                      </div>
                      <div className="col-span-1 p-3 text-right border-r border-border/50 pr-3 flex items-center justify-end text-xs">
                        {e.entryType === "credit" ? formatAmount(e.amount) : "—"}
                      </div>
                      <div className="col-span-1 p-3 text-right pr-3 flex items-center justify-end font-semibold text-xs">
                        {formatAmount(e.balance, e.balance >= 0 ? "Dr" : "Cr")}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Month Total and Closing */}
              <div className="grid grid-cols-12 border-t border-border bg-muted/10 font-mono text-sm font-bold text-foreground">
                <div className="col-span-8 p-3.5 pl-4 uppercase font-sans font-black text-xs">Monthly Total</div>
                <div className="col-span-1 p-3.5 text-right border-r border-border/50 pr-3 font-black text-xs">
                  {formatAmount(selectedMonth?.debit || 0)}
                </div>
                <div className="col-span-1 p-3.5 text-right border-r border-border/50 pr-3 font-black text-xs">
                  {formatAmount(selectedMonth?.credit || 0)}
                </div>
                <div className="col-span-2" />
              </div>

              <div className="grid grid-cols-12 border-t-2 border-b-2 border-double border-border bg-muted/20 font-mono text-sm font-bold text-foreground">
                <div className="col-span-8 p-3.5 pl-4 uppercase font-sans font-black text-xs">Closing Balance</div>
                <div className="col-span-1 border-r border-border/50" />
                <div className="col-span-1 border-r border-border/50" />
                <div className="col-span-2 p-3.5 text-right pr-3 font-black text-base">
                  {formatAmount(Math.abs(selectedMonth?.closingBalance || 0), (selectedMonth?.closingBalance || 0) >= 0 ? "Dr" : "Cr")}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={!!selectedBillForDetails} onOpenChange={(open) => { if (!open) setSelectedBillForDetails(null); }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground uppercase tracking-wider text-sm font-semibold">Payment Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Bill Reference</p>
              <p className="text-sm font-bold text-foreground font-mono">{selectedBillForDetails?.refNo}</p>
            </div>
            <div className="border border-border rounded-md overflow-hidden bg-card">
              <div className="grid grid-cols-3 bg-muted/40 text-[10px] font-bold uppercase p-2 border-b border-border text-muted-foreground">
                <div>Date</div>
                <div>Voucher</div>
                <div className="text-right">Amount</div>
              </div>
              <div className="divide-y divide-border/60 max-h-60 overflow-y-auto">
                {selectedBillForDetails?.payments && selectedBillForDetails.payments.length > 0 ? (
                  selectedBillForDetails.payments.map((p, idx) => {
                    const isDebitNote = p.voucherType === "debit_note";
                    const isCreditNote = p.voucherType === "credit_note";
                    // For purchase vendor bills, debit note reduces the total outstanding / represents a negative paid item
                    const isVendor = selectedLedger?.ledgerType === "company" || selectedLedger?.ledgerType === "supplier";
                    const sign = (isVendor && isDebitNote) ? "-" : "";
                    return (
                      <div key={idx} className="grid grid-cols-3 p-2 text-xs font-mono text-foreground hover:bg-muted/10 transition-colors">
                        <div className="text-[11px] text-muted-foreground flex items-center font-sans">
                          {fmtDate(p.voucherDate, true)}
                        </div>
                        <div className="font-sans flex flex-col justify-center">
                          <span className="font-semibold text-foreground truncate text-[11px]">
                            {p.voucherNo}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase">
                            {p.voucherType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className={`text-right font-bold flex items-center justify-end ${isDebitNote ? "text-destructive" : "text-foreground"}`}>
                          {sign}{formatAmount(p.amount)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground font-sans">
                    No payment details found.
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center bg-muted/20 p-3 rounded-md border border-border/50 font-mono text-sm font-bold">
              <span className="font-sans text-xs text-muted-foreground uppercase">Total Adjusted</span>
              <span className="text-foreground">
                {formatAmount(selectedBillForDetails?.paidAmount || 0, selectedBillForDetails?.type)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 text-sm" onClick={() => setSelectedBillForDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LedgerReportClient(props: LedgerReportClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Ledger Report</span></div>}>
      <LedgerReportContent {...props} />
    </Suspense>
  );
}
