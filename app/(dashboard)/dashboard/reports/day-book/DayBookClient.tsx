"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { getVoucherRedirectUrl } from "@/lib/utils";

interface Company {
  companyId: number;
  companyName: string;
}

interface VoucherEntry {
  entryId: number;
  entryType: "debit" | "credit";
  amount: number;
  ledgerName: string;
}

interface VoucherItem {
  itemId: number;
  quantity: number;
  rate: number;
  netAmount: number;
  itemName?: string | null;
}

interface Voucher {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  extraCharges: number;
  partyName?: string | null;
  entries: VoucherEntry[];
  items: VoucherItem[];
}

interface DayBookClientProps {
  company: Company;
  vouchers: Voucher[];
  canExport: boolean;
  initialDate: string;
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  sale: "Sales",
  purchase: "Purchase",
  payment: "Payment",
  receipt: "Receipt",
  journal: "Journal",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  job_outward: "Job Outward",
  job_inward: "Job Inward",
  mill_outward: "Mill Outward",
  mill_inward: "Mill Inward",
};

function DayBookContent({
  company,
  vouchers,
  canExport,
  initialDate,
}: DayBookClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Date defaults
  const dateParam = searchParams.get("date") || initialDate;

  const [isDetailed, setIsDetailed] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dateParam);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync date selection with browser's local timezone on mount if date param is absent
  useEffect(() => {
    if (!searchParams.get("date")) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const localTodayStr = `${year}-${month}-${day}`;
      setSelectedDate(localTodayStr);
      router.replace(`?date=${localTodayStr}`);
    } else {
      setSelectedDate(dateParam);
    }
  }, [searchParams, dateParam, router]);

  // Helper: Format to Indian Currency
  const formatAmount = (val: number) => {
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);

    if (val < 0) {
      return `(-) ${formatted}`;
    }
    return formatted;
  };

  // Helper: Format date to DD-MMM-YY (Tally style)
  const formatDateToTally = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Helper: Determine Debit vs Credit columns per voucher row
  const getDebitAndCredit = (v: Voucher) => {
    let debit: number | null = null;
    let credit: number | null = null;
    const amount = v.netAmount;

    switch (v.voucherType) {
      case "sale":
      case "job_outward":
      case "mill_outward":
      case "debit_note":
        debit = amount;
        break;
      case "purchase":
      case "job_inward":
      case "mill_inward":
      case "credit_note":
        credit = amount;
        break;
      case "payment":
        debit = amount;
        break;
      case "receipt":
        credit = amount;
        break;
      case "journal": {
        const debitSum = v.entries
          .filter((e) => e.entryType === "debit")
          .reduce((sum, e) => sum + e.amount, 0);
        const creditSum = v.entries
          .filter((e) => e.entryType === "credit")
          .reduce((sum, e) => sum + e.amount, 0);
        if (debitSum > 0) debit = debitSum;
        if (creditSum > 0) credit = creditSum;
        break;
      }
      default:
        debit = amount;
    }

    return { debit, credit };
  };

  // Filter vouchers based on search
  const filteredVouchers = vouchers.filter((v) => {
    const term = searchQuery.toLowerCase();
    const party = (v.partyName || "").toLowerCase();
    const vchNo = (v.voucherNo || "").toLowerCase();
    const typeLabel = (VOUCHER_TYPE_LABELS[v.voucherType] || "").toLowerCase();
    return party.includes(term) || vchNo.includes(term) || typeLabel.includes(term);
  });

  // Calculate totals
  const totalDebit = filteredVouchers.reduce((sum, v) => sum + (getDebitAndCredit(v).debit || 0), 0);
  const totalCredit = filteredVouchers.reduce((sum, v) => sum + (getDebitAndCredit(v).credit || 0), 0);

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print Styles for Suppression of Headers */}
      <style
        dangerouslySetInnerHTML={{
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
            background-color: white !important;
          }
        }
      `,
        }}
      />

      {/* Screen Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Day Book</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Client Search Bar */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border h-9 text-sm"
            />
          </div>

          {/* Detailed/Condensed View Toggle */}
          <Button variant="outline" onClick={() => setIsDetailed(!isDetailed)} className="flex items-center gap-2 h-9 text-sm">
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed View" : "Detailed View"}
          </Button>

          {/* Direct Date Input Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="direct-date" className="sr-only">Date</Label>
            <Input
              id="direct-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newDate = e.target.value;
                setSelectedDate(newDate);
                router.push(`?date=${newDate}`);
              }}
              className="w-40 bg-card border-border font-mono text-sm h-9"
            />
          </div>

          {/* Save PDF */}
          <Button onClick={triggerPrint} className="flex items-center gap-2 bg-primary text-primary-foreground h-9 text-sm">
            <Download className="h-4 w-4" />
            Save PDF
          </Button>
        </div>
      </div>

      {/* Tally-style Report Table Area */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area">
        {/* Printable-only Company Header */}
        <div className="hidden print:block text-center py-6 border-b border-border bg-card mb-4">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{company.companyName}</h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">Day Book</p>
          <p className="text-xs text-muted-foreground mt-1 font-semibold">
            For {formatDateToTally(dateParam)}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3 text-left w-28">Date</th>
              <th className="p-3 text-left">Particulars</th>
              <th className="p-3 text-left w-36">Vch Type</th>
              <th className="p-3 text-left w-24">Vch No.</th>
              <th className="p-3 text-right w-44">Debit Amount</th>
              <th className="p-3 text-right w-44">Credit Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredVouchers.map((v) => {
              const { debit, credit } = getDebitAndCredit(v);
              return (
                <React.Fragment key={v.voucherId}>
                  <tr
                    className="border-b border-border hover:bg-muted/20 text-foreground transition duration-150 cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) {
                        return;
                      }
                      router.push(getVoucherRedirectUrl(v.voucherType, v.voucherId));
                    }}
                  >
                    <td className="p-3 text-left font-mono font-medium">{formatDateToTally(v.voucherDate)}</td>
                    <td className="p-3 text-left font-semibold">{v.partyName || "Cash / General Ledger"}</td>
                    <td className="p-3 text-left">{VOUCHER_TYPE_LABELS[v.voucherType] || v.voucherType}</td>
                    <td className="p-3 text-left font-mono">{v.voucherNo}</td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {debit !== null && debit > 0 ? formatAmount(debit) : "—"}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {credit !== null && credit > 0 ? formatAmount(credit) : "—"}
                    </td>
                  </tr>

                  {/* Alt+F1 Detailed Sub-Row Postings & Inventory */}
                  {isDetailed && (
                    <tr className="bg-muted/10">
                      <td colSpan={6} className="p-0 border-b border-border/50">
                        <div className="pl-12 pr-6 py-2.5 space-y-3 font-mono text-xs text-muted-foreground border-l-2 border-primary/20">
                          {/* Inventory line items */}
                          {v.items.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">Inventory Items:</p>
                              {v.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between pl-4 text-foreground/80">
                                  <span>
                                    {item.itemName || "Stock Item"}{" "}
                                    <span className="text-[10px] text-muted-foreground">
                                      ({item.quantity} units @ ₹{item.rate.toFixed(2)})
                                    </span>
                                  </span>
                                  <span className="font-mono">₹{formatAmount(item.netAmount)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Accounting ledger entries */}
                          {v.entries.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">Ledger Splits:</p>
                              {v.entries.map((entry, idx) => {
                                const isPurchaseDr = v.voucherType === "purchase" && entry.entryType === "debit";
                                const isSaleCr = v.voucherType === "sale" && entry.entryType === "credit";
                                
                                return (
                                  <div key={idx} className="space-y-1">
                                    <div className="grid grid-cols-6 gap-2 pl-4 text-foreground/80">
                                      <span className="col-span-3">
                                        {entry.ledgerName}{" "}
                                        <span className="text-[10px] text-muted-foreground">
                                          ({entry.entryType === "debit" ? "Dr" : "Cr"})
                                        </span>
                                      </span>
                                      <span className="col-span-1 text-right font-mono">
                                        {entry.entryType === "debit" ? `₹${formatAmount(entry.amount)}` : ""}
                                      </span>
                                      <span className="col-span-1 text-right font-mono col-start-5">
                                        {entry.entryType === "credit" ? `₹${formatAmount(entry.amount)}` : ""}
                                      </span>
                                    </div>
                                    
                                    {/* Component breakdown details under primary posting */}
                                    {(isPurchaseDr || isSaleCr) && (
                                      <div className="pl-8 border-l border-border/80 text-[11px] text-muted-foreground space-y-1">
                                        {v.items.map((item, itemIdx) => (
                                          <div key={itemIdx} className="flex justify-between max-w-sm text-[10px]">
                                            <span>| {item.itemName || "Stock Item"}</span>
                                            <span className="font-mono">₹{formatAmount(item.netAmount)}</span>
                                          </div>
                                        ))}
                                        {v.extraCharges > 0 && (
                                          <div className="flex justify-between max-w-sm text-[10px]">
                                            <span>| Charges / Freight</span>
                                            <span className="font-mono">₹{formatAmount(v.extraCharges)}</span>
                                          </div>
                                        )}
                                        {v.taxAmount > 0 && (
                                          <div className="flex justify-between max-w-sm text-[10px]">
                                            <span>| GST Tax</span>
                                            <span className="font-mono">₹{formatAmount(v.taxAmount)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {filteredVouchers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No vouchers found for the selected period.
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="border-t-2 border-border bg-muted/20 font-bold text-foreground">
              <td className="p-3 text-left" colSpan={4}>
                Grand Total
              </td>
              <td className="p-3 text-right font-mono text-base">{formatAmount(totalDebit)}</td>
              <td className="p-3 text-right font-mono text-base">{formatAmount(totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default function DayBookClient(props: DayBookClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Day Book</span></div>}>
      <DayBookContent {...props} />
    </Suspense>
  );
}
