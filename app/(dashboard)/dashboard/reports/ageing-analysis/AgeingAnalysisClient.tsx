"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Bill {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  partyName: string;
  netAmount: number;
  pendingAmount: number;
  dueDate: string;
  creditDays: number;
}

interface Company { companyId: number; companyName: string; gstNo?: string | null; address?: string | null; }
interface Props { company: Company; payableBills: Bill[]; receivableBills: Bill[]; canExport: boolean; }

const BUCKETS = [
  { label: "Not Due", from: null, to: 0 },
  { label: "0–30 Days", from: 0, to: 30 },
  { label: "31–60 Days", from: 30, to: 60 },
  { label: "61–90 Days", from: 60, to: 90 },
  { label: "> 90 Days", from: 90, to: null },
];

function getOverdueDays(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getBucket(overdueDays: number) {
  if (overdueDays < 0) return 0; // Not Due
  if (overdueDays <= 30) return 1;
  if (overdueDays <= 60) return 2;
  if (overdueDays <= 90) return 3;
  return 4;
}

function AgeingAnalysisContent({ company, payableBills, receivableBills, canExport }: Props) {
  const [mode, setMode] = useState<"payable" | "receivable">("payable");
  const [fromDays, setFromDays] = useState<string>("");
  const [toDays, setToDays] = useState<string>("");

  const bills = mode === "payable" ? payableBills : receivableBills;

  const formatAmount = (val: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(val));

  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt.getTime())) return d;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dt.getDate()}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  };

  // Filter bills by overdue days range
  const filteredBills = bills.filter((bill) => {
    const overdueDays = getOverdueDays(bill.dueDate);
    const fDays = fromDays !== "" ? Number(fromDays) : null;
    const tDays = toDays !== "" ? Number(toDays) : null;

    if (fDays !== null && overdueDays < fDays) return false;
    if (tDays !== null && overdueDays > tDays) return false;
    return true;
  });

  // Group bills into buckets
  const bucketed: Bill[][] = BUCKETS.map(() => []);
  filteredBills.forEach(bill => {
    const overdueDays = getOverdueDays(bill.dueDate);
    bucketed[getBucket(overdueDays)].push(bill);
  });

  const bucketTotals = bucketed.map(group => group.reduce((s, b) => s + b.pendingAmount, 0));
  const grandTotal = bucketTotals.reduce((s, t) => s + t, 0);

  const bucketColors = [
    "text-foreground",
    "text-primary",
    "text-warning",
    "text-orange-500",
    "text-destructive",
  ];
  const bucketBgColors = [
    "bg-muted/20",
    "bg-primary/5",
    "bg-warning/10",
    "bg-orange-500/10",
    "bg-destructive/10",
  ];

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 0mm; } body { margin: 0mm !important; } .print-area { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; padding: 1.5rem !important; box-sizing: border-box !important; background: white !important; color: black !important; } }` }} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Ageing Analysis</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Overdue Days Range Filters */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1.5 h-10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Overdue:</span>
            <Input
              type="number"
              placeholder="Min"
              min={0}
              value={fromDays}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes("-") || Number(val) < 0) return;
                setFromDays(val);
              }}
              className="w-20 h-7 text-xs px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-foreground placeholder:text-muted-foreground/60"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <Input
              type="number"
              placeholder="Max"
              min={0}
              value={toDays}
              onChange={(e) => {
                const val = e.target.value;
                if (val.includes("-") || Number(val) < 0) return;
                setToDays(val);
              }}
              className="w-20 h-7 text-xs px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-foreground placeholder:text-muted-foreground/60"
            />
            <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">days</span>
          </div>

          <Button
            variant={mode === "payable" ? "default" : "outline"}
            onClick={() => setMode("payable")}
            className="flex items-center gap-2"
          >
            Bills Payable
          </Button>
          <Button
            variant={mode === "receivable" ? "default" : "outline"}
            onClick={() => setMode("receivable")}
            className="flex items-center gap-2"
          >
            Bills Receivable
          </Button>
          <Button variant="outline" onClick={() => setMode(m => m === "payable" ? "receivable" : "payable")} className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          {canExport && <Button onClick={() => window.print()} className="flex items-center gap-2"><Download className="h-4 w-4" />Save as PDF</Button>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
        {BUCKETS.map((bucket, i) => (
          <div key={bucket.label} className={`rounded-lg border border-border p-4 ${bucketBgColors[i]}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{bucket.label}</p>
            <p className={`text-lg font-bold mt-1 font-mono ${bucketColors[i]}`}>{formatAmount(bucketTotals[i])}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{bucketed[i].length} bills</p>
          </div>
        ))}
      </div>

      {/* Main Report Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{company.companyName}</h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Ageing Analysis — {mode === "payable" ? "Bills Payable" : "Bills Receivable"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">As on {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>

        {BUCKETS.map((bucket, bi) => (
          bucketed[bi].length === 0 ? null : (
            <div key={bucket.label}>
              <div className={`px-6 py-2 border-b border-border ${bucketBgColors[bi]}`}>
                <span className={`text-xs font-bold uppercase tracking-widest ${bucketColors[bi]}`}>{bucket.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">({bucketed[bi].length} bills · ₹{formatAmount(bucketTotals[bi])})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="p-3 text-left pl-6">Bill Date</th>
                      <th className="p-3 text-left">Bill No.</th>
                      <th className="p-3 text-left">Party</th>
                      <th className="p-3 text-center">Credit Days</th>
                      <th className="p-3 text-center">Due Date</th>
                      <th className="p-3 text-center border-l border-border">Overdue Days</th>
                      <th className="p-3 text-right border-l border-border">Bill Amount</th>
                      <th className="p-3 text-right border-l border-border">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-foreground">
                    {bucketed[bi].map(bill => {
                      const overdueDays = getOverdueDays(bill.dueDate);
                      return (
                        <tr key={bill.voucherId} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 pl-6 font-mono text-xs">{formatDate(bill.voucherDate)}</td>
                          <td className="p-3 font-mono text-xs font-medium">{bill.voucherNo}</td>
                          <td className="p-3 font-medium text-foreground">{bill.partyName}</td>
                          <td className="p-3 text-center text-muted-foreground text-xs">{bill.creditDays}d</td>
                          <td className="p-3 text-center font-mono text-xs">{formatDate(bill.dueDate)}</td>
                          <td className="p-3 text-center border-l border-border">
                            {overdueDays < 0
                              ? <span className="text-xs text-primary font-semibold">In {Math.abs(overdueDays)}d</span>
                              : <span className={`text-xs font-bold ${bucketColors[bi]}`}>{overdueDays}d</span>
                            }
                          </td>
                          <td className="p-3 text-right border-l border-border font-mono text-xs text-muted-foreground">{formatAmount(bill.netAmount)}</td>
                          <td className={`p-3 text-right border-l border-border font-mono font-bold ${bucketColors[bi]}`}>{formatAmount(bill.pendingAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ))}

        {bills.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground italic">
            No outstanding {mode === "payable" ? "payable" : "receivable"} bills found.
          </div>
        )}

        <div className="border-t-2 border-double border-border bg-muted/20 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Grand Total Outstanding</span>
          <span className="text-base font-bold font-mono text-foreground">₹{formatAmount(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

export default function AgeingAnalysisClient(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Ageing Analysis</span></div>}>
      <AgeingAnalysisContent {...props} />
    </Suspense>
  );
}
