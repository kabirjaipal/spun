"use client";

import React, { useState, Suspense } from "react";
import { Download, Calendar, Search, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Order {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: number;
  status: string;
  partyName: string;
  dueDate: string | null;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface Props {
  company: Company;
  orders: Order[];
  canExport: boolean;
}

function PurchaseOrderSummaryContent({ company, orders, canExport }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const formatAmount = (val: number) => {
    if (Math.abs(val) < 0.01) return "—";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDateToTally = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt.getTime())) return d;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${dt.getDate()}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  };

  const activeOrders = orders.filter((o) => !removedLines.includes(String(o.voucherId)));
  const filteredOrders = activeOrders.filter((o) => {
    const term = searchQuery.toLowerCase();
    return (
      o.partyName.toLowerCase().includes(term) ||
      o.voucherNo.toLowerCase().includes(term)
    );
  });

  const totalAmount = filteredOrders.reduce((sum, o) => sum + o.netAmount, 0);

  const handleRestoreLine = () => {
    if (lastRemovedLine) {
      setRemovedLines((p) => p.filter((n) => n !== lastRemovedLine));
      setLastRemovedLine(null);
    } else if (removedLines.length > 0) {
      const c = [...removedLines];
      const p = c.pop();
      setRemovedLines(c);
      setLastRemovedLine(p || null);
    }
  };

  return (
    <div className="space-y-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page { margin: 0mm; }
            body { margin: 0mm !important; }
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
        `,
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h1 className="text-xl font-bold text-foreground">Purchase Order Summary</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border h-10 text-sm"
            />
          </div>
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>
          {canExport && (
            <Button onClick={() => window.print()} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Save as PDF
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{company.companyName}</h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">Purchase Order Summary</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {formatDateToTally(fromParam)} to {formatDateToTally(toParam)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 w-[120px]">Date</th>
                <th className="p-3 text-left w-[150px]">Order No.</th>
                <th className="p-3 text-left min-w-[200px]">Party Name</th>
                <th className="p-3 text-center w-[120px]">Due Date</th>
                <th className="p-3 text-center w-[120px]">Status</th>
                <th className="p-3 text-right border-l border-border w-[160px]">Order Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                    No purchase orders found for the selected period
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.voucherId} className="group/row hover:bg-muted/10 transition-colors font-medium">
                    <td className="p-3 pl-6 font-mono text-xs whitespace-nowrap">{formatDateToTally(o.voucherDate)}</td>
                    <td className="p-3 font-mono text-xs">{o.voucherNo}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-between">
                        <span>{o.partyName}</span>
                        <button
                          onClick={() => {
                            setRemovedLines((p) => [...p, String(o.voucherId)]);
                            setLastRemovedLine(String(o.voucherId));
                          }}
                          className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                        >
                          Omit
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">{o.dueDate ? formatDateToTally(o.dueDate) : "—"}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-right border-l border-border font-mono font-bold">{formatAmount(o.netAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6" colSpan={5}>Total</td>
                <td className="p-3 text-right border-l border-border font-mono text-base text-foreground">{formatAmount(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>You have hidden <strong>{removedLines.length}</strong> orders.</span>
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
            <div className="grid gap-2">
              <Label htmlFor="from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From Date</Label>
              <Input id="from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 text-sm bg-background border-border" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To Date</Label>
              <Input id="to" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 text-sm bg-background border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowPeriodModal(false); router.push(`?from=${startDate}&to=${endDate}`); }} className="h-10 text-sm">Apply Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PurchaseOrderSummaryClient(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Purchase Order Summary...</div>}>
      <PurchaseOrderSummaryContent {...props} />
    </Suspense>
  );
}
