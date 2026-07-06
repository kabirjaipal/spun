"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { Download, Calendar, ArrowLeft, Search, BookOpen, FileText } from "lucide-react";
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
  pendingAmount: number;
  dueOn: string;
  overdueDays: number;
  type: "Dr" | "Cr";
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

  const isPartyLedger = selectedLedger &&
    (selectedLedger.ledgerType === "customer" || selectedLedger.ledgerType === "company");
  const [viewMode, setViewMode] = useState<"vouchers" | "outstandings">("vouchers");

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
  };

  // ─── Outstandings Calculation ────────────────────────────────────────────────
  const calculateOutstandings = (): PendingBill[] => {
    if (!selectedLedger || !isPartyLedger) return [];

    const isCustomer = selectedLedger.ledgerType === "customer";
    const defaultType: "Dr" | "Cr" = isCustomer ? "Dr" : "Cr";
    const targetType = isCustomer ? "sale" : "purchase";

    const invoices = vouchers.filter((v) => v.voucherType === targetType);
    const adjustments = vouchers.filter((v) => v.voucherType !== targetType);

    const paidAmounts: Record<number, number> = {};
    const unlinkedAdjustments: { date: string; amount: number; voucherNo: string }[] = [];

    adjustments.forEach((adj) => {
      let linkedSum = 0;
      if (adj.billDetails && Array.isArray(adj.billDetails)) {
        adj.billDetails.forEach((item: any) => {
          if (item && typeof item === "object" && "voucherId" in item) {
            const vId = Number(item.voucherId);
            const amt = Number(item.amount) || 0;
            paidAmounts[vId] = (paidAmounts[vId] || 0) + amt;
            linkedSum += amt;
          }
        });
      }
      const adjAmt = Number(adj.netAmount) || 0;
      const unlinked = adjAmt - linkedSum;
      if (unlinked > 0.01) {
        unlinkedAdjustments.push({ date: adj.voucherDate, amount: unlinked, voucherNo: adj.voucherNo });
      }
    });

    const pendingBills: PendingBill[] = [];

    invoices.forEach((inv) => {
      const opening = Number(inv.netAmount) || 0;
      const paid = paidAmounts[inv.voucherId] || 0;
      const pending = opening - paid;
      if (pending > 0.01) {
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
          openingAmount: opening,
          pendingAmount: pending,
          dueOn: dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
          overdueDays,
          type: defaultType,
        });
      }
    });

    unlinkedAdjustments.forEach((adj) => {
      pendingBills.push({
        date: adj.date,
        refNo: "On Account",
        openingAmount: adj.amount,
        pendingAmount: adj.amount,
        dueOn: "—",
        overdueDays: 0,
        type: defaultType === "Dr" ? "Cr" : "Dr",
      });
    });

    return pendingBills;
  };

  const pendingBills = calculateOutstandings();
  const totalOpening = pendingBills.reduce((s, b) => s + (b.type === "Cr" ? -b.openingAmount : b.openingAmount), 0);
  const totalPending = pendingBills.reduce((s, b) => s + (b.type === "Cr" ? -b.pendingAmount : b.pendingAmount), 0);

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
            <h1 className="text-xl font-bold text-foreground">Ledger Report</h1>
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
                  <div className="col-span-3 p-3.5 pl-4 border-r border-border">Ref. No.</div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border pr-4">Opening Amount</div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border pr-4">Pending Amount</div>
                  <div className="col-span-1 p-3.5 border-r border-border pl-3">Due on</div>
                  <div className="col-span-1 p-3.5 text-right pr-4">Overdue</div>
                </div>

                {/* Data rows */}
                <div className="divide-y divide-border/40 font-mono text-sm">
                  {pendingBills.map((bill, i) => (
                    <div key={i} className="grid grid-cols-12 hover:bg-muted/30 text-foreground transition-colors">
                      <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-foreground/80 flex items-center text-xs">
                        {fmtDate(bill.date, true)}
                      </div>
                      <div className="col-span-3 p-3 pl-4 border-r border-border/50 font-sans font-semibold text-foreground flex items-center">
                        {bill.refNo}
                      </div>
                      <div className="col-span-3 p-3 text-right border-r border-border/50 pr-4 flex items-center justify-end">
                        {formatAmount(bill.openingAmount, bill.type)}
                      </div>
                      <div className="col-span-2 p-3 text-right border-r border-border/50 pr-4 flex items-center justify-end font-bold">
                        {formatAmount(bill.pendingAmount, bill.type)}
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
                  <div className="col-span-5 p-3.5 pl-4 uppercase font-sans font-black">Total Pending</div>
                  <div className="col-span-3 p-3.5 text-right border-r border-border/50 pr-4 font-black">
                    {formatAmount(Math.abs(totalOpening), totalOpening >= 0 ? "Dr" : "Cr")}
                  </div>
                  <div className="col-span-2 p-3.5 text-right border-r border-border/50 pr-4 font-black">
                    {formatAmount(Math.abs(totalPending), totalPending >= 0 ? "Dr" : "Cr")}
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
              reportTitle="Ledger Vouchers"
              subTitle={`${selectedLedger.ledgerName} | ${fmtDate(startDate)} to ${fmtDate(endDate)}`}
            />

            {/* Screen header */}
            <div className="border-b border-border bg-muted/20 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
              <div>
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">Ledger Vouchers</p>
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
                  <div key={e.entryId} className="grid grid-cols-12 hover:bg-muted/30 transition-colors font-mono text-sm text-foreground">
                    <div className="col-span-2 p-3 pl-4 border-r border-border/50 text-foreground/70 flex items-center text-xs font-sans">
                      {fmtDate(e.voucherDate, true)}
                    </div>
                    <div className="col-span-4 p-3 pl-4 border-r border-border/50 font-sans font-semibold text-foreground flex items-center truncate text-xs">
                      {e.particulars}
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
    </div>
  );
}

export default function LedgerReportClient(props: LedgerReportClientProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Ledger Report...</div>}>
      <LedgerReportContent {...props} />
    </Suspense>
  );
}
