"use client";

import React, { useState, Suspense } from "react";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface VoucherDetail { voucherId: number; voucherNo: string; voucherDate: string; netAmount: number; status: string; partyName: string; }
interface MonthlySummaryItem { monthKey: string; monthName: string; year: number; totalVouchers: number; cancelledVouchers: number; netAmount: number; vouchers: VoucherDetail[]; }
interface Company { companyId: number; companyName: string; gstNo?: string | null; address?: string | null; }
interface Props { company: Company; monthlySummary: MonthlySummaryItem[]; canExport: boolean; }

function CreditNoteRegisterContent({ company, monthlySummary, canExport }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fyStartYear = (() => { const m = new Date().getMonth(); const y = new Date().getFullYear(); return m >= 3 ? y : y - 1; })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [selectedMonth, setSelectedMonth] = useState<MonthlySummaryItem | null>(null);
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const formatAmount = (val: number) => {
    if (val === 0) return "—";
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(val));
  };

  const handleRestoreLine = () => {
    if (lastRemovedLine) { setRemovedLines(p => p.filter(n => n !== lastRemovedLine)); setLastRemovedLine(null); }
    else if (removedLines.length > 0) { const c = [...removedLines]; const p = c.pop(); setRemovedLines(c); setLastRemovedLine(p || null); }
  };

  const activeSummary = monthlySummary.filter(item => !removedLines.includes(`${item.monthName} ${item.year}`));
  const totalVouchersSum = activeSummary.reduce((s, i) => s + i.totalVouchers, 0);
  const cancelledVouchersSum = activeSummary.reduce((s, i) => s + i.cancelledVouchers, 0);
  const netAmountSum = activeSummary.reduce((s, i) => s + i.netAmount, 0);

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 0mm; } body { margin: 0mm !important; } .print-area { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; padding: 1.5rem !important; box-sizing: border-box !important; background: white !important; color: black !important; } }` }} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h1 className="text-xl font-bold text-foreground">Credit Note Register</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2"><Calendar className="h-4 w-4" />Period</Button>
          {canExport && <Button onClick={() => window.print()} className="flex items-center gap-2"><Download className="h-4 w-4" />Save as PDF</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{company.companyName}</h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">Credit Note Register</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]" rowSpan={2}>Particulars</th>
                <th className="p-2 text-center border-l border-border" colSpan={2}>Transactions</th>
                <th className="p-2 text-right border-l border-border font-bold w-[160px]" rowSpan={2}>Amount</th>
              </tr>
              <tr className="border-b border-border bg-muted/20 text-xs font-bold uppercase text-muted-foreground">
                <th className="p-2 text-right border-l border-border font-semibold w-[120px]">Total Vouchers</th>
                <th className="p-2 text-right border-l border-border font-semibold w-[120px] text-destructive/80">(cancelled)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground">
              {activeSummary.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-xs text-muted-foreground italic">No records found for the selected period</td></tr>
              ) : activeSummary.map(item => {
                const label = `${item.monthName} ${item.year}`;
                const hasVouchers = item.totalVouchers > 0;
                return (
                  <tr key={item.monthKey} onClick={() => hasVouchers && setSelectedMonth(item)} className={`group/row hover:bg-muted/10 transition-colors ${hasVouchers ? "cursor-pointer" : ""}`}>
                    <td className="p-3 pl-6 font-medium">
                      <div className="flex items-center justify-between">
                        <span>{item.monthName}</span>
                        <button onClick={e => { e.stopPropagation(); setRemovedLines(p => [...p, label]); setLastRemovedLine(label); }} className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal">Omit</button>
                      </div>
                    </td>
                    <td className="p-2 text-right border-l border-border font-mono text-muted-foreground">{item.totalVouchers > 0 ? item.totalVouchers : "—"}</td>
                    <td className="p-2 text-right border-l border-border font-mono text-destructive">{item.cancelledVouchers > 0 ? item.cancelledVouchers : "—"}</td>
                    <td className="p-2 text-right border-l border-border font-mono font-semibold">{formatAmount(item.netAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6">Grand Total</td>
                <td className="p-2 text-right border-l border-border font-mono">{totalVouchersSum > 0 ? totalVouchersSum : "—"}</td>
                <td className="p-2 text-right border-l border-border font-mono text-destructive">{cancelledVouchersSum > 0 ? cancelledVouchersSum : "—"}</td>
                <td className="p-2 text-right border-l border-border font-mono text-base">{formatAmount(netAmountSum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>You have hidden <strong>{removedLines.length}</strong> months from the register.</span>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 px-3" onClick={handleRestoreLine}>Restore Last</Button>
            <Button variant="outline" className="h-9 px-3 text-destructive border-destructive/25 hover:bg-destructive/10" onClick={() => { setRemovedLines([]); setLastRemovedLine(null); }}>Restore All</Button>
          </div>
        </div>
      )}

      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Change Report Period</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">From</Label>
              <Input id="from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="col-span-3 h-10 text-sm" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">To</Label>
              <Input id="to" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="col-span-3 h-10 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowPeriodModal(false); router.push(`?from=${startDate}&to=${endDate}`); }} className="h-10">Apply Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedMonth !== null} onOpenChange={open => !open && setSelectedMonth(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Credit Notes — {selectedMonth?.monthName} {selectedMonth?.year}</DialogTitle></DialogHeader>
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
                {selectedMonth?.vouchers.map(v => (
                  <tr key={v.voucherId} className={`hover:bg-muted/10 transition-colors ${v.status === "cancelled" ? "bg-destructive/5 text-muted-foreground" : ""}`}>
                    <td className="py-3 px-3">{new Date(v.voucherDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="py-3 px-3 font-mono font-medium">{v.voucherNo}</td>
                    <td className="py-3 px-3">{v.partyName}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${v.status === "cancelled" ? "bg-destructive/10 text-destructive border border-destructive/20" : v.status === "draft" ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" : "bg-primary/10 text-primary border border-primary/20"}`}>{v.status}</span>
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-semibold ${v.status === "cancelled" ? "line-through text-muted-foreground/60" : ""}`}>{formatAmount(v.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreditNoteRegisterClient(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Credit Note Register...</div>}>
      <CreditNoteRegisterContent {...props} />
    </Suspense>
  );
}
