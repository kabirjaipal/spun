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
    // GroupNames helper
    const getGroupNames = (gId: number | null): string[] => {
      if (!gId) return [];
      const names: string[] = [];
      let cur = gId;
      for (let i = 0; i < 10; i++) {
        const g = groups.find((x) => x.groupId === cur);
        if (!g) break;
        names.push(g.groupName.toLowerCase());
        if (!g.parentGroupId) break;
        cur = g.parentGroupId;
      }
      return names;
    };

    // PL classification helper (must match ProfitLossClient)
    const getPLCategory = (l: Ledger) => {
      const name = l.ledgerName.toLowerCase();
      const type = l.ledgerType.toLowerCase();
      const gNames = getGroupNames(l.groupId || null);
      const hasGroup = (str: string) => gNames.some((gn) => gn.includes(str));

      if (type === "sales_return" || name.includes("sales return") || name.includes("sales_return") || hasGroup("sales return") || hasGroup("sales_return")) {
        return "sales_return";
      }
      if (type === "purchase_return" || name.includes("purchase return") || name.includes("purchase_return") || hasGroup("purchase return") || hasGroup("purchase_return")) {
        return "purchase_return";
      }
      if (type === "sales" || name.includes("sales account") || hasGroup("sales account") || gNames.some((gn) => gn === "sales")) {
        return "sales";
      }
      if (type === "purchase" || name.includes("purchase account") || hasGroup("purchase account") || gNames.some((gn) => gn === "purchase")) {
        return "purchase";
      }
      if (gNames.some((gn) => gn.includes("direct expense")) || (type === "expense" && (hasGroup("direct") || hasGroup("trading") || hasGroup("manufacturing")))) {
        return "direct_expense";
      }
      if (gNames.some((gn) => gn.includes("indirect expense")) || type === "expense" || type === "general") {
        return "indirect_expense";
      }
      if (gNames.some((gn) => gn.includes("direct income")) || (type === "income" && (hasGroup("direct") || hasGroup("trading") || hasGroup("revenue")))) {
        return "direct_income";
      }
      if (gNames.some((gn) => gn.includes("indirect income")) || type === "income") {
        return "indirect_income";
      }
      return null;
    };

    // Calculate net profit exactly like P&L
    let salesGrossTotal = 0;
    let salesReturnTotal = 0;
    let purchaseGrossTotal = 0;
    let purchaseReturnTotal = 0;
    let directExpTotal = 0;
    let directIncTotal = 0;
    let indirectExpTotal = 0;
    let indirectIncTotal = 0;

    ledgers.forEach((l) => {
      const plCat = getPLCategory(l);
      if (!plCat) return;

      if (plCat === "sales") {
        salesGrossTotal += l.credit - l.debit;
      } else if (plCat === "sales_return") {
        salesReturnTotal += l.debit - l.credit;
      } else if (plCat === "purchase") {
        purchaseGrossTotal += l.debit - l.credit;
      } else if (plCat === "purchase_return") {
        purchaseReturnTotal += l.credit - l.debit;
      } else if (plCat === "direct_expense") {
        directExpTotal += l.debit - l.credit;
      } else if (plCat === "direct_income") {
        directIncTotal += l.credit - l.debit;
      } else if (plCat === "indirect_expense") {
        indirectExpTotal += l.debit - l.credit;
      } else if (plCat === "indirect_income") {
        indirectIncTotal += l.credit - l.debit;
      }
    });

    const netSalesTotal = salesGrossTotal - salesReturnTotal;
    const netPurchaseTotal = purchaseGrossTotal - purchaseReturnTotal;

    const drSide1 = calculatedOpeningStock + netPurchaseTotal + directExpTotal;
    const crSide1 = netSalesTotal + directIncTotal + calculatedClosingStock;
    const grossProfit = crSide1 - drSide1;

    const grossLossBF = grossProfit < 0 ? Math.abs(grossProfit) : 0;
    const grossProfitBF = grossProfit > 0 ? grossProfit : 0;

    const drSide2 = grossLossBF + indirectExpTotal;
    const crSide2 = grossProfitBF + indirectIncTotal;
    const netProfitVal = crSide2 - drSide2;

    // Classify non-PL ledgers
    const liabilitiesMap: Record<string, { name: string; amount: number; ledgerId?: number }[]> = {
      "Capital Account": [],
      "Secured Loans": [],
      "Unsecured Loans": [],
      "Provisions": [],
      "Preliminery Expenses": [],
      "Sundry Creditors": [],
      "Suspense Ac": [],
      "Bad Debts": [],
    };

    const assetsMap: Record<string, { name: string; amount: number; ledgerId?: number }[]> = {
      "Fixed Assets": [],
      "Deposit Assets": [],
      "Investments": [],
      "Loan (Assets)": [],
      "Cash & Bank Ac": [],
      "Sundry Debtors": [],
    };

    ledgers.forEach((l) => {
      const plCat = getPLCategory(l);
      if (plCat) return; // Skip PL

      const name = l.ledgerName;
      const type = l.ledgerType.toLowerCase();
      const gNames = getGroupNames(l.groupId || null);

      let bsGroup: string | null = null;

      if (gNames.some((gn) => gn.includes("bad debt")) || name.toLowerCase().includes("bad debt")) {
        bsGroup = "Bad Debts";
      } else if (gNames.some((gn) => gn.includes("capital")) || type === "capital") {
        bsGroup = "Capital Account";
      } else if (gNames.some((gn) => gn.includes("secured loan")) && !gNames.some((gn) => gn.includes("unsecured"))) {
        bsGroup = "Secured Loans";
      } else if (gNames.some((gn) => gn.includes("unsecured loan"))) {
        bsGroup = "Unsecured Loans";
      } else if (gNames.some((gn) => gn.includes("provision")) || gNames.some((gn) => gn.includes("tax")) || gNames.some((gn) => gn.includes("duties")) || type === "tax") {
        bsGroup = "Provisions";
      } else if (gNames.some((gn) => gn.includes("preliminary")) || gNames.some((gn) => gn.includes("preliminery")) || name.toLowerCase().includes("preliminary") || name.toLowerCase().includes("preliminery")) {
        bsGroup = "Preliminery Expenses";
      } else if (gNames.some((gn) => gn.includes("creditor")) || type === "company") {
        bsGroup = "Sundry Creditors";
      } else if (gNames.some((gn) => gn.includes("suspense"))) {
        bsGroup = "Suspense Ac";
      } else if (gNames.some((gn) => gn.includes("fixed asset"))) {
        bsGroup = "Fixed Assets";
      } else if (gNames.some((gn) => gn.includes("deposit"))) {
        bsGroup = "Deposit Assets";
      } else if (gNames.some((gn) => gn.includes("investment"))) {
        bsGroup = "Investments";
      } else if (gNames.some((gn) => gn.includes("loan (asset)")) || gNames.some((gn) => gn.includes("loan(asset)")) || gNames.some((gn) => gn.includes("loans (asset)")) || type === "loan_asset") {
        bsGroup = "Loan (Assets)";
      } else if (gNames.some((gn) => gn.includes("cash")) || gNames.some((gn) => gn.includes("bank")) || type === "cash" || type === "bank") {
        bsGroup = "Cash & Bank Ac";
      } else if (gNames.some((gn) => gn.includes("debtor")) || type === "customer") {
        bsGroup = "Sundry Debtors";
      } else {
        // Fallback based on net balance
        const net = l.debit - l.credit;
        if (net < 0) {
          bsGroup = "Suspense Ac";
        } else {
          bsGroup = "Deposit Assets";
        }
      }

      if (bsGroup in liabilitiesMap) {
        if (bsGroup === "Preliminery Expenses" || bsGroup === "Bad Debts") {
          liabilitiesMap[bsGroup].push({ name, amount: l.debit - l.credit, ledgerId: l.ledgerId });
        } else {
          liabilitiesMap[bsGroup].push({ name, amount: l.credit - l.debit, ledgerId: l.ledgerId });
        }
      } else if (bsGroup in assetsMap) {
        assetsMap[bsGroup].push({ name, amount: l.debit - l.credit, ledgerId: l.ledgerId });
      }
    });

    // Compute initial sums (excluding Suspense Ac and Net Profit/Loss)
    const initialAssetsTotal =
      assetsMap["Fixed Assets"].reduce((s, i) => s + i.amount, 0) +
      assetsMap["Deposit Assets"].reduce((s, i) => s + i.amount, 0) +
      assetsMap["Investments"].reduce((s, i) => s + i.amount, 0) +
      assetsMap["Loan (Assets)"].reduce((s, i) => s + i.amount, 0) +
      assetsMap["Cash & Bank Ac"].reduce((s, i) => s + i.amount, 0) +
      calculatedClosingStock +
      assetsMap["Sundry Debtors"].reduce((s, i) => s + i.amount, 0) +
      (netProfitVal > 0 ? netProfitVal : 0);

    const initialLiabilitiesTotal =
      liabilitiesMap["Capital Account"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Secured Loans"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Unsecured Loans"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Provisions"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Preliminery Expenses"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Sundry Creditors"].reduce((s, i) => s + i.amount, 0) +
      liabilitiesMap["Bad Debts"].reduce((s, i) => s + i.amount, 0) +
      (netProfitVal < 0 ? Math.abs(netProfitVal) : 0);

    // Calculate suspense difference to make it balance perfectly
    const existingSuspense = liabilitiesMap["Suspense Ac"].reduce((s, i) => s + i.amount, 0);
    const suspenseDifference = initialAssetsTotal - (initialLiabilitiesTotal + existingSuspense);

    if (Math.abs(suspenseDifference) > 0.009) {
      liabilitiesMap["Suspense Ac"].push({
        name: "Difference in Opening Balances",
        amount: suspenseDifference,
      });
    }

    const liabilitiesList = [
      {
        name: "Capital Account",
        amount: liabilitiesMap["Capital Account"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Capital Account"],
      },
      {
        name: "Secured Loans",
        amount: liabilitiesMap["Secured Loans"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Secured Loans"],
      },
      {
        name: "Unsecured Loans",
        amount: liabilitiesMap["Unsecured Loans"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Unsecured Loans"],
      },
      {
        name: "Provisions",
        amount: liabilitiesMap["Provisions"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Provisions"],
      },
      {
        name: "Preliminery Expenses",
        amount: liabilitiesMap["Preliminery Expenses"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Preliminery Expenses"],
      },
      {
        name: "Sundry Creditors",
        amount: liabilitiesMap["Sundry Creditors"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Sundry Creditors"],
      },
      {
        name: "Suspense Ac",
        amount: liabilitiesMap["Suspense Ac"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Suspense Ac"],
      },
      {
        name: "Bad Debts",
        amount: liabilitiesMap["Bad Debts"].reduce((s, i) => s + i.amount, 0),
        ledgers: liabilitiesMap["Bad Debts"],
      },
    ];

    const assetsList = [
      {
        name: "Fixed Assets",
        amount: assetsMap["Fixed Assets"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Fixed Assets"],
      },
      {
        name: "Deposit Assets",
        amount: assetsMap["Deposit Assets"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Deposit Assets"],
      },
      {
        name: "Investments",
        amount: assetsMap["Investments"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Investments"],
      },
      {
        name: "Loan (Assets)",
        amount: assetsMap["Loan (Assets)"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Loan (Assets)"],
      },
      {
        name: "Cash & Bank Ac",
        amount: assetsMap["Cash & Bank Ac"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Cash & Bank Ac"],
      },
      {
        name: "Closing Stock",
        amount: calculatedClosingStock,
        ledgers: calculatedClosingStock > 0 ? [{ name: "Stock-in-hand", amount: calculatedClosingStock }] : [],
      },
      {
        name: "Sundry Debtors",
        amount: assetsMap["Sundry Debtors"].reduce((s, i) => s + i.amount, 0),
        ledgers: assetsMap["Sundry Debtors"],
      },
    ];

    if (netProfitVal >= 0) {
      assetsList.push({
        name: "Net Profit",
        amount: netProfitVal,
        ledgers: [{ name: "Current Period Profit", amount: netProfitVal }],
      });
    } else {
      liabilitiesList.push({
        name: "Net Loss",
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
            as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Top Header Box to mimic Tally style */}
        <div className="grid grid-cols-3 bg-muted/50 text-muted-foreground px-4 py-2.5 text-xs font-bold border-b border-border uppercase tracking-wider no-print">
          <div>Balance Sheet</div>
          <div className="text-center text-foreground font-semibold">{company.companyName}</div>
          <div className="text-right">
            As At {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        {/* Header Columns */}
        <div className="grid grid-cols-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {/* Liabilities Header */}
          <div className="flex items-center p-3 border-r border-border bg-muted/20">
            <span className="flex-1 font-bold text-sm text-foreground">Liabilities</span>
            <span className="w-36 text-right pr-4 font-normal text-xs normal-case text-muted-foreground"></span>
            <span className="w-36 text-right font-semibold text-xs normal-case text-muted-foreground">
              as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          {/* Assets Header */}
          <div className="flex items-center p-3 pl-4 bg-muted/20">
            <span className="flex-1 font-bold text-sm text-foreground">Assets</span>
            <span className="w-36 text-right pr-4 font-normal text-xs normal-case text-muted-foreground"></span>
            <span className="w-36 text-right font-semibold text-xs normal-case text-muted-foreground">
              as at {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Content Columns Side-by-Side */}
        <div className="grid grid-cols-2 text-sm min-h-[400px]">
          {/* Liabilities Column */}
          <div className="col-span-1 flex flex-col border-r border-border justify-between">
            <div className="flex-1 py-2">
              {displayLiabilities.map((grp) => (
                <div key={grp.name} className="group/row">
                  {/* Main Group Row */}
                  <div
                    onClick={() => grp.ledgers.length > 0 && setDrillDownData({ title: grp.name, items: grp.ledgers })}
                    className="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold text-foreground">{grp.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(grp.name);
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 no-print"
                      >
                        Omit
                      </button>
                    </div>
                    <div className="flex">
                      <div className="w-36"></div>
                      <div className="w-36 text-right font-mono font-bold text-foreground">
                        {Math.abs(grp.amount) > 0.009 ? formatAmount(grp.amount) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Sub-Ledgers (Detailed View) */}
                  {isDetailed && grp.ledgers && (
                    <div className="pb-2">
                      {grp.ledgers.map((l, idx) => (
                        <div
                          key={l.name}
                          className="flex items-center justify-between py-1.5 px-3 pl-8 hover:bg-muted/10 group/ledg"
                        >
                          <div className="flex-1 flex items-center gap-2">
                            {l.ledgerId ? (
                              <a
                                href={`/dashboard/reports/ledger-report?ledgerId=${l.ledgerId}`}
                                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                              >
                                {l.name}
                              </a>
                            ) : (
                              <span className="text-xs italic text-foreground/80">{l.name}</span>
                            )}
                            <button
                              onClick={() => handleRemoveLine(l.name)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-xs text-destructive hover:underline no-print"
                            >
                              Omit
                            </button>
                          </div>
                          <div className="flex">
                            <div className={`w-36 text-right pr-4 font-mono text-xs text-foreground/90 ${
                              idx === grp.ledgers.length - 1 ? "border-b border-border pb-0.5" : ""
                            }`}>
                              {formatAmount(l.amount)}
                            </div>
                            <div className="w-36"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total Row for Liabilities */}
            <div className="border-t border-border bg-muted/20 p-3 flex items-center justify-between font-bold border-b-4 border-double">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{formatAmount(finalTotal)}</div>
              </div>
            </div>
          </div>

          {/* Assets Column */}
          <div className="col-span-1 flex flex-col justify-between">
            <div className="flex-1 py-2">
              {displayAssets.map((grp) => (
                <div key={grp.name} className="group/row">
                  {/* Main Group Row */}
                  <div
                    onClick={() => grp.ledgers.length > 0 && setDrillDownData({ title: grp.name, items: grp.ledgers })}
                    className="flex items-center justify-between py-2.5 px-3 hover:bg-muted/30 cursor-pointer"
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold text-foreground">{grp.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLine(grp.name);
                        }}
                        className="opacity-0 group-hover/row:opacity-100 text-xs text-destructive hover:underline p-1 no-print"
                      >
                        Omit
                      </button>
                    </div>
                    <div className="flex">
                      <div className="w-36"></div>
                      <div className="w-36 text-right font-mono font-bold text-foreground">
                        {Math.abs(grp.amount) > 0.009 ? formatAmount(grp.amount) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Sub-Ledgers (Detailed View) */}
                  {isDetailed && grp.ledgers && (
                    <div className="pb-2">
                      {grp.ledgers.map((l, idx) => (
                        <div
                          key={l.name}
                          className="flex items-center justify-between py-1.5 px-3 pl-8 hover:bg-muted/10 group/ledg"
                        >
                          <div className="flex-1 flex items-center gap-2">
                            {l.ledgerId ? (
                              <a
                                href={`/dashboard/reports/ledger-report?ledgerId=${l.ledgerId}`}
                                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                              >
                                {l.name}
                              </a>
                            ) : (
                              <span className="text-xs italic text-foreground/80">{l.name}</span>
                            )}
                            <button
                              onClick={() => handleRemoveLine(l.name)}
                              className="opacity-0 group-hover/ledg:opacity-100 text-xs text-destructive hover:underline no-print"
                            >
                              Omit
                            </button>
                          </div>
                          <div className="flex">
                            <div className={`w-36 text-right pr-4 font-mono text-xs text-foreground/90 ${
                              idx === grp.ledgers.length - 1 ? "border-b border-border pb-0.5" : ""
                            }`}>
                              {formatAmount(l.amount)}
                            </div>
                            <div className="w-36"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total Row for Assets */}
            <div className="border-t border-border bg-muted/20 p-3 flex items-center justify-between font-bold border-b-4 border-double">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{formatAmount(finalTotal)}</div>
              </div>
            </div>
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
