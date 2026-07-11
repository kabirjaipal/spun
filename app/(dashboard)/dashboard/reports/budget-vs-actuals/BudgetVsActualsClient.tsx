"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  debit: number;
  credit: number;
}

interface Group {
  groupId: number;
  groupName: string;
}

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface Props {
  company: Company;
  ledgers: Ledger[];
  groups: Group[];
  canExport: boolean;
}

function BudgetVsActualsContent({ company, ledgers, groups, canExport }: Props) {
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
  const [budgets, setBudgets] = useState<Record<number, number>>({});
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  // Initialize sensible mock budget values based on actual balances so the user sees populated data on first load
  useEffect(() => {
    const initialBudgets: Record<number, number> = {};
    ledgers.forEach((l) => {
      const balance = Math.abs(l.debit - l.credit);
      if (balance > 0) {
        // Budget is actual amount +/- some randomized offset (e.g. rounded value)
        const roundAmount = Math.ceil(balance * 1.15 / 1000) * 1000;
        initialBudgets[l.ledgerId] = roundAmount || 10000;
      } else {
        initialBudgets[l.ledgerId] = 0;
      }
    });
    setBudgets(initialBudgets);
  }, [ledgers]);

  const handleBudgetChange = (ledgerId: number, val: string) => {
    const num = parseFloat(val) || 0;
    setBudgets((prev) => ({
      ...prev,
      [ledgerId]: num,
    }));
  };

  const getGroupName = (groupId: number | null) => {
    if (!groupId) return "No Group";
    const g = groups.find((group) => group.groupId === groupId);
    return g ? g.groupName : "Unknown Group";
  };

  const formatAmount = (val: number) => {
    if (Math.abs(val) < 0.01) return "0.00";
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

  const activeLedgers = ledgers.filter((l) => !removedLines.includes(String(l.ledgerId)));
  const filteredLedgers = activeLedgers.filter((l) => {
    const term = searchQuery.toLowerCase();
    return (
      l.ledgerName.toLowerCase().includes(term) ||
      getGroupName(l.groupId).toLowerCase().includes(term)
    );
  });

  const totalBudget = filteredLedgers.reduce((sum, l) => sum + (budgets[l.ledgerId] || 0), 0);
  const totalActual = filteredLedgers.reduce((sum, l) => sum + Math.abs(l.debit - l.credit), 0);
  const totalVariance = totalActual - totalBudget;
  const totalVariancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

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
            .no-print-input {
              border: none !important;
              background: transparent !important;
              padding: 0 !important;
              text-align: right !important;
            }
          }
        `,
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <h1 className="text-xl font-bold text-foreground">Budget vs Actuals</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ledgers..."
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
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">Budget vs Actuals Report</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {formatDateToTally(fromParam)} to {formatDateToTally(toParam)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left pl-6 min-w-[200px]">Ledger Name</th>
                <th className="p-3 text-left w-[180px]">Group Name</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Budgeted Amt</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Actual Amt</th>
                <th className="p-3 text-right border-l border-border w-[140px]">Variance</th>
                <th className="p-3 text-right border-l border-border w-[100px]">Var %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground">
              {filteredLedgers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground italic">
                    No ledger accounts found
                  </td>
                </tr>
              ) : (
                filteredLedgers.map((l) => {
                  const actualVal = Math.abs(l.debit - l.credit);
                  const budgetVal = budgets[l.ledgerId] ?? 0;
                  const variance = actualVal - budgetVal;
                  const variancePercent = budgetVal > 0 ? (variance / budgetVal) * 100 : 0;

                  return (
                    <tr key={l.ledgerId} className="group/row hover:bg-muted/10 transition-colors font-medium">
                      <td className="p-3 pl-6">
                        <div className="flex items-center justify-between">
                          <span>{l.ledgerName}</span>
                          <button
                            onClick={() => {
                              setRemovedLines((p) => [...p, String(l.ledgerId)]);
                              setLastRemovedLine(String(l.ledgerId));
                            }}
                            className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-2 no-print font-normal"
                          >
                            Omit
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{getGroupName(l.groupId)}</td>
                      <td className="p-2 border-l border-border text-right">
                        <input
                          type="number"
                          value={budgetVal || ""}
                          onChange={(e) => handleBudgetChange(l.ledgerId, e.target.value)}
                          placeholder="0.00"
                          className="w-full text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary/45 rounded px-2 py-1 font-mono text-sm no-print-input"
                        />
                      </td>
                      <td className="p-3 text-right border-l border-border font-mono">{formatAmount(actualVal)}</td>
                      <td className={`p-3 text-right border-l border-border font-mono ${variance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatAmount(variance)}
                      </td>
                      <td className={`p-3 text-right border-l border-border font-mono text-xs ${variance >= 0 ? "text-primary" : "text-destructive"}`}>
                        {variancePercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-double border-border bg-muted/20 text-sm font-bold">
                <td className="p-3 pl-6" colSpan={2}>Total</td>
                <td className="p-3 text-right border-l border-border font-mono text-foreground">{formatAmount(totalBudget)}</td>
                <td className="p-3 text-right border-l border-border font-mono text-foreground">{formatAmount(totalActual)}</td>
                <td className={`p-3 text-right border-l border-border font-mono ${totalVariance >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatAmount(totalVariance)}
                </td>
                <td className={`p-3 text-right border-l border-border font-mono text-xs ${totalVariance >= 0 ? "text-primary" : "text-destructive"}`}>
                  {totalVariancePercent.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>You have hidden <strong>{removedLines.length}</strong> lines.</span>
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

export default function BudgetVsActualsClient(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Budget vs Actuals</span></div>}>
      <BudgetVsActualsContent {...props} />
    </Suspense>
  );
}
