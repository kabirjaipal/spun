"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, RefreshCw, Eye, EyeOff, X } from "lucide-react";
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

interface LedgerGroup {
  groupId: number;
  groupName: string;
  parentGroupId?: number | null;
}

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId?: number | null;
  debit: number;
  credit: number;
}

interface BalanceSheetClientProps {
  company: Company;
  groups: LedgerGroup[];
  ledgers: Ledger[];
  calculatedClosingStock: number;
  calculatedOpeningStock: number;
  canExport: boolean;
}

// Demo data removed

function BalanceSheetContent({
  company,
  groups,
  ledgers,
  calculatedClosingStock,
  calculatedOpeningStock,
  canExport,
}: BalanceSheetClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Period state from URL or defaults
  // Dynamic current FY defaults (April start)
  const fyStartYear = (() => { const m = new Date().getMonth(); const y = new Date().getFullYear(); return m >= 3 ? y : y - 1; })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [isDetailed, setIsDetailed] = useState(true);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // Omission lists
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  // Drill-down details modal
  const [drillDownData, setDrillDownData] = useState<{
    title: string;
    items: { name: string; amount: number; ledgerId?: number }[];
  } | null>(null);

  // Helper: Format to Indian Currency (en-IN)
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

  // -------------------------------------------------------------
  // LIVE DATA ROLLUP CALCULATION
  // -------------------------------------------------------------
  const getLiveReportData = () => {
    const getSubGroup = (groupId: number | null, ledgerType: string): string => {
      if (ledgerType === "capital") return "Capital Account";
      if (ledgerType === "loan") return "Loans (Liability)";
      if (ledgerType === "tax") return "Duties & Taxes";
      if (ledgerType === "cash") return "Cash-in-hand";
      if (ledgerType === "bank") return "Bank Accounts";
      if (ledgerType === "customer") return "Sundry Debtors";
      if (ledgerType === "company") return "Sundry Creditors";

      if (groupId) {
        const gp = groups.find((g) => g.groupId === groupId);
        if (gp) {
          const name = gp.groupName.toLowerCase();
          if (name.includes("bank")) return "Bank Accounts";
          if (name.includes("cash")) return "Cash-in-hand";
          if (name.includes("debtor")) return "Sundry Debtors";
          if (name.includes("creditor")) return "Sundry Creditors";
          if (name.includes("secured") || name.includes("unsecured") || name.includes("loan")) {
            if (name.includes("secured") && !name.includes("unsecured")) return "Secured Loans";
            if (name.includes("unsecured")) return "Unsecured Loans";
            return "Loans (Liability)";
          }
          if (name.includes("tax") || name.includes("duties")) return "Duties & Taxes";
          if (name.includes("provision")) return "Provisions";
          if (name.includes("fixed asset")) return "Fixed Assets";
          if (name.includes("investment")) return "Investments";
          if (name.includes("capital")) return "Capital Account";
          return gp.groupName;
        }
      }
      return "Current Assets";
    };

    const isLiabilityGroup = (sub: string): boolean => {
      const lower = sub.toLowerCase();
      return (
        lower.includes("capital") ||
        lower.includes("loan") ||
        lower.includes("creditor") ||
        lower.includes("tax") ||
        lower.includes("duties") ||
        lower.includes("provision") ||
        lower.includes("liability")
      );
    };

    const liabilitiesGroups: Record<string, { name: string; amount: number; ledgerId?: number }[]> = {};
    const assetsGroups: Record<string, { name: string; amount: number; ledgerId?: number }[]> = {};

    let salesTotal = 0;
    let purchaseTotal = 0;
    let expensesTotal = 0;
    let incomeTotal = 0;

    ledgers.forEach((l) => {
      const bal = Number(l.debit) - Number(l.credit);

      const isPL =
        l.ledgerType === "sales" ||
        l.ledgerType === "purchase" ||
        l.ledgerType === "expense" ||
        l.ledgerType === "income" ||
        (l.groupId &&
          groups
            .find((g) => g.groupId === l.groupId)
            ?.groupName.toLowerCase()
            .match(/(sales|purchase|expense|income|profit|loss)/));

      if (isPL) {
        if (l.ledgerType === "sales" || l.ledgerType === "income") {
          salesTotal += -bal;
        } else {
          purchaseTotal += bal;
        }
        return;
      }

      const sub = getSubGroup(l.groupId || null, l.ledgerType);
      const name = l.ledgerName;

      // Skip stock ledger balances (opening stock) in assets list, as closing stock is added separately
      if (sub.toLowerCase().includes("stock")) {
        return;
      }

      if (isLiabilityGroup(sub)) {
        if (!liabilitiesGroups[sub]) liabilitiesGroups[sub] = [];
        liabilitiesGroups[sub].push({ name, amount: -bal, ledgerId: l.ledgerId });
      } else {
        if (!assetsGroups[sub]) assetsGroups[sub] = [];
        assetsGroups[sub].push({ name, amount: bal, ledgerId: l.ledgerId });
      }
    });

    if (calculatedClosingStock > 0) {
      assetsGroups["Stock-in-hand"] = [{ name: "Closing Stock", amount: calculatedClosingStock }];
    }

    const netProfitVal = salesTotal + calculatedClosingStock - calculatedOpeningStock - purchaseTotal - expensesTotal + incomeTotal;

    const liabilitiesList = Object.entries(liabilitiesGroups).map(([name, items]) => ({
      name,
      amount: items.reduce((s, i) => s + i.amount, 0),
      ledgers: items,
    }));

    const assetsList = Object.entries(assetsGroups).map(([name, items]) => ({
      name,
      amount: items.reduce((s, i) => s + i.amount, 0),
      ledgers: items,
    }));

    if (netProfitVal >= 0) {
      liabilitiesList.push({
        name: "Profit & Loss A/c",
        amount: netProfitVal,
        ledgers: [{ name: "Current Period Profit", amount: netProfitVal }],
      });
    } else {
      assetsList.push({
        name: "Profit & Loss A/c",
        amount: Math.abs(netProfitVal),
        ledgers: [{ name: "Current Period Loss", amount: Math.abs(netProfitVal) }],
      });
    }

    return { liabilitiesList, assetsList };
  };

  const { liabilitiesList, assetsList } = getLiveReportData();

  const filteredLiabilities = liabilitiesList
    .filter((grp) => !removedLines.includes(grp.name))
    .map((grp) => ({
      ...grp,
      ledgers: grp.ledgers.filter((l) => !removedLines.includes(l.name)),
    }));

  const filteredAssets = assetsList
    .filter((grp) => !removedLines.includes(grp.name))
    .map((grp) => ({
      ...grp,
      ledgers: grp.ledgers.filter((l) => !removedLines.includes(l.name)),
    }));

  const totalLiabilities = filteredLiabilities.reduce((s, g) => s + g.amount, 0);
  const totalAssets = filteredAssets.reduce((s, g) => s + g.amount, 0);

  const balanceDiff = Math.abs(totalLiabilities - totalAssets);
  const hasDiff = balanceDiff > 0.01;

  const displayLiabilities = [...filteredLiabilities];
  const displayAssets = [...filteredAssets];

  if (hasDiff) {
    if (totalLiabilities < totalAssets) {
      displayLiabilities.push({
        name: "Difference in Opening Balances",
        amount: balanceDiff,
        ledgers: [],
      });
    } else {
      displayAssets.push({
        name: "Difference in Opening Balances",
        amount: balanceDiff,
        ledgers: [],
      });
    }
  }

  const finalTotal = Math.max(totalLiabilities, totalAssets);

  // -------------------------------------------------------------
  // PRINT TO PDF
  // -------------------------------------------------------------
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">

      {/* Minimal print styling to hide browser header/footer URL and date stamps */}
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
            padding: 1rem !important;
            box-sizing: border-box !important;
          }
        }
      `}} />
      {/* Minimal Spun Title & Controls Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground">Balance Sheet</h1>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Detailed vs Condensed Toggle */}
          <Button
            variant="outline"
            onClick={() => setIsDetailed(!isDetailed)}
            className="flex items-center gap-2"
          >
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed View" : "Detailed View"}
          </Button>

          {/* Period Button */}
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          {/* Export PDF Button */}
          <Button onClick={triggerPrint} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Main Report Table Grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area">
        {/* Print-only Header */}
        <div className="hidden print:block text-center py-6 border-b border-border bg-card">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Balance Sheet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
          </p>
        </div>
        {/* Header Columns */}
        <div className="grid grid-cols-4 border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-1 p-3">Liabilities</div>
          <div className="col-span-1 p-3 text-right font-normal border-r border-border normal-case">
            as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
          </div>
          <div className="col-span-1 p-3 pl-4">Assets</div>
          <div className="col-span-1 p-3 text-right font-normal normal-case">
            as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
          </div>
        </div>

        {/* Content Columns Side-by-Side */}
        <div className="grid grid-cols-2 text-sm min-h-[300px]">
          {/* Liabilities Column */}
          <div className="col-span-1 flex flex-col border-r border-border">
            <div className="flex-1">
              {displayLiabilities.map((grp) => (
                <div key={grp.name} className="group/row">
                  {/* Main Group Row */}
                  <div
                    onClick={() => grp.ledgers.length > 0 && setDrillDownData({ title: grp.name, items: grp.ledgers })}
                    className={`flex justify-between items-center p-3 hover:bg-muted/30 cursor-pointer ${grp.name === "Capital Account" ? "bg-amber-100/30 dark:bg-amber-900/5 font-semibold" : ""
                      }`}
                  >
                    <span className="font-bold text-foreground">{grp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground font-mono">
                        {Math.abs(grp.amount) > 0.009 ? formatAmount(grp.amount) : "—"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(grp.name);
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-1 no-print"
                      >
                        Omit
                      </button>
                    </div>
                  </div>

                  {/* Sub-Ledgers (Detailed View) */}
                  {isDetailed && grp.ledgers && (
                    <div className="pl-6 pb-2">
                      {grp.ledgers.map((l) => (
                        <div
                          key={l.name}
                          className="flex justify-between items-center py-1.5 px-3 text-xs text-foreground/90 group/ledg"
                        >
                          {l.ledgerId ? (
                            <a
                              href={`/dashboard/reports/ledger-report?ledgerId=${l.ledgerId}`}
                              className="italic text-primary hover:underline font-semibold cursor-pointer"
                            >
                              {l.name}
                            </a>
                          ) : (
                            <span className="italic">{l.name}</span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatAmount(l.amount)}</span>
                            <button
                              onClick={() => handleRemoveLine(l.name)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline no-print"
                            >
                              Omit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Assets Column */}
          <div className="col-span-1 flex flex-col">
            <div className="flex-1">
              {displayAssets.map((grp) => (
                <div key={grp.name} className="group/row">
                  {/* Main Group Row */}
                  <div
                    onClick={() => grp.ledgers.length > 0 && setDrillDownData({ title: grp.name, items: grp.ledgers })}
                    className="flex justify-between items-center p-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <span className="font-bold text-foreground">{grp.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground font-mono">
                        {Math.abs(grp.amount) > 0.009 ? formatAmount(grp.amount) : "—"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(grp.name);
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 ml-1 no-print"
                      >
                        Omit
                      </button>
                    </div>
                  </div>

                  {/* Sub-Ledgers (Detailed View) */}
                  {isDetailed && grp.ledgers && (
                    <div className="pl-6 pb-2">
                      {grp.ledgers.map((l) => (
                        <div
                          key={l.name}
                          className="flex justify-between items-center py-1.5 px-3 text-xs text-foreground/90 group/ledg"
                        >
                          {l.ledgerId ? (
                            <a
                              href={`/dashboard/reports/ledger-report?ledgerId=${l.ledgerId}`}
                              className="italic text-primary hover:underline font-semibold cursor-pointer"
                            >
                              {l.name}
                            </a>
                          ) : (
                            <span className="italic">{l.name}</span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatAmount(l.amount)}</span>
                            <button
                              onClick={() => handleRemoveLine(l.name)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-[10px] text-destructive hover:underline no-print"
                            >
                              Omit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals Section */}
        <div className="grid grid-cols-2 border-t border-border text-sm font-bold bg-muted/20">
          <div className="col-span-1 p-3 flex justify-between items-center border border-border">
            <span>Total</span>
            <span className="font-mono text-base">{formatAmount(finalTotal)}</span>
          </div>
          <div className="col-span-1 p-3 flex justify-between items-center border border-border">
            <span>Total</span>
            <span className="font-mono text-base">{formatAmount(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Omission alert controls if lines were omitted */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> items from the report structure. The sheet remains mathematically balanced.
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={handleRestoreLine}>
              Restore Last
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive border-destructive/25 hover:bg-destructive/10"
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

      {/* Period Selector dialog */}
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
                onChange={(e) => setStartDate(e.target.value)}
                className="col-span-3"
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
                onChange={(e) => setEndDate(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleApplyPeriod}
            >
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Account Details Modal */}
      <Dialog open={drillDownData !== null} onOpenChange={(open) => !open && setDrillDownData(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{drillDownData?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border font-bold text-muted-foreground">
                  <th className="text-left py-2">Ledger / Sub-Account Name</th>
                  <th className="text-right py-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {drillDownData?.items.map((it) => (
                  <tr key={it.name} className="border-b border-border/50 hover:bg-muted/10">
                    <td className="py-2.5 font-medium">
                      {it.ledgerId ? (
                        <a
                          href={`/dashboard/reports/ledger-report?ledgerId=${it.ledgerId}`}
                          className="text-primary hover:underline font-semibold cursor-pointer"
                        >
                          {it.name}
                        </a>
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold">{formatAmount(it.amount)}</td>
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

export default function BalanceSheetClient(props: BalanceSheetClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Balance Sheet</span></div>}>
      <BalanceSheetContent {...props} />
    </Suspense>
  );
}
