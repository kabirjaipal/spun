"use client";

import React, { useState, useMemo, Suspense } from "react";
import { ChevronDown, ChevronRight, ArrowLeft, Calendar, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface InventoryGroup {
  groupId: number;
  groupName: string;
}

interface InventoryCategory {
  categoryId: number;
  categoryName: string;
}

interface InventoryItem {
  inventoryId: number;
  inventoryCode: string;
  inventoryName: string;
  unit: string;
  openingStockQty: number;
  openingStockRate: number;
  inventoryGroupId: number | null;
  inventoryCategoryId: number | null;
}

interface StockMovement {
  stockMovementId: number;
  inventoryId: number;
  voucherId: number | null;
  movementType: string;
  quantity: number;
  rate: number;
  amount: number;
  voucherDate: string;
  voucherNo: string | null;
  voucherType: string | null;
}

interface StockSummaryClientProps {
  company: Company;
  groups: InventoryGroup[];
  categories: InventoryCategory[];
  items: InventoryItem[];
  movements: StockMovement[];
  canExport: boolean;
}

function StockSummaryContent({
  company,
  groups,
  categories,
  items,
  movements,
  canExport,
}: StockSummaryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. Period State defaults (fiscal year starting in April)
  const fyStartYear = useMemo(() => {
     const m = new Date().getMonth();
     const y = new Date().getFullYear();
     return m >= 3 ? y : y - 1;
  }, []);

  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Screen routing states
  const [currentScreen, setCurrentScreen] = useState<"summary" | "groupSummary" | "monthly">("summary");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // UI display options
  const [grouping, setGrouping] = useState<"group" | "category" | "none">("group");
  const [isDetailed, setIsDetailed] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
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

  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  // Indian Currency Formatting
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

  // Quantity Formatting
  const formatQty = (val: number, unit: string) => {
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);

    if (val < 0) {
      return `(-) ${formatted} ${unit}`;
    }
    return `${formatted} ${unit}`;
  };

  // -------------------------------------------------------------
  // STOCK CALCULATION ROLLUP
  // -------------------------------------------------------------
  const processedItems = useMemo(() => {
    return items.map((item) => {
      const itemMovements = movements.filter((m) => m.inventoryId === item.inventoryId);

      const opQtyConfig = item.openingStockQty;
      const opRateConfig = item.openingStockRate;

      let opQtyBefore = opQtyConfig;
      let opValueBefore = opQtyConfig * opRateConfig;
      let totalInwardQtyUpToTo = opQtyConfig;
      let totalInwardValueUpToTo = opQtyConfig * opRateConfig;

      let inwardQtyPeriod = 0;
      let inwardValuePeriod = 0;
      let outwardQtyPeriod = 0;
      let outwardValuePeriod = 0;

      itemMovements.forEach((m) => {
        const qty = m.quantity;
        const rate = m.rate;
        const amount = m.amount;
        const dateStr = m.voucherDate;

        const isInward =
          m.movementType === "purchase" ||
          m.movementType === "opening" ||
          (m.movementType === "adjustment" && qty >= 0);

        const currentQty = Math.abs(qty);
        const currentValue = amount > 0 ? amount : currentQty * (rate > 0 ? rate : opRateConfig);

        if (dateStr < fromParam) {
          if (isInward) {
            opQtyBefore += currentQty;
            opValueBefore += currentValue;
            totalInwardQtyUpToTo += currentQty;
            totalInwardValueUpToTo += currentValue;
          } else {
            opQtyBefore -= currentQty;
            const historicalAvgInwardRate =
              totalInwardQtyUpToTo > 0 ? totalInwardValueUpToTo / totalInwardQtyUpToTo : opRateConfig;
            opValueBefore -= currentQty * historicalAvgInwardRate;
          }
        } else if (dateStr <= toParam) {
          if (isInward) {
            inwardQtyPeriod += currentQty;
            inwardValuePeriod += currentValue;
            totalInwardQtyUpToTo += currentQty;
            totalInwardValueUpToTo += currentValue;
          } else {
            outwardQtyPeriod += currentQty;
            outwardValuePeriod += amount > 0 ? amount : currentQty * rate;
          }
        }
      });

      const weightedAvgInwardRate =
        totalInwardQtyUpToTo > 0 ? totalInwardValueUpToTo / totalInwardQtyUpToTo : opRateConfig;

      const closingQty = opQtyBefore + inwardQtyPeriod - outwardQtyPeriod;
      const closingValue = closingQty * weightedAvgInwardRate;

      return {
        ...item,
        openingQty: opQtyBefore,
        openingRate: opQtyBefore > 0 ? opValueBefore / opQtyBefore : opRateConfig,
        openingValue: opValueBefore,
        inwardQty: inwardQtyPeriod,
        inwardValue: inwardValuePeriod,
        outwardQty: outwardQtyPeriod,
        outwardValue: outwardValuePeriod,
        closingQty,
        closingRate: closingQty >= 0 ? weightedAvgInwardRate : null,
        closingValue: closingQty >= 0 ? closingValue : null,
      };
    });
  }, [items, movements, fromParam, toParam]);

  // Grouped items
  const groupedData = useMemo(() => {
    const reportList = processedItems.filter((i) => !removedLines.includes(i.inventoryName));

    if (grouping === "none") {
      return [{ groupName: "All Items", items: reportList }];
    }

    const map: Record<string, typeof reportList> = {};

    reportList.forEach((item) => {
      let gName = "Unassigned";
      if (grouping === "group") {
        const grp = groups.find((g) => g.groupId === item.inventoryGroupId);
        if (grp) gName = grp.groupName;
      } else {
        const cat = categories.find((c) => c.categoryId === item.inventoryCategoryId);
        if (cat) gName = cat.categoryName;
      }

      if (!removedLines.includes(gName)) {
        if (!map[gName]) {
          map[gName] = [];
        }
        map[gName].push(item);
      }
    });

    return Object.entries(map).map(([gName, items]) => ({
      groupName: gName,
      items,
    }));
  }, [processedItems, grouping, groups, categories, removedLines]);

  // Grand total calculations
  const totalValueSum = useMemo(() => {
    if (currentScreen === "groupSummary" && selectedGroup) {
      return processedItems
        .filter((i) => {
          let gName = "";
          if (grouping === "group") {
            const grp = groups.find((g) => g.groupId === i.inventoryGroupId);
            if (grp) gName = grp.groupName;
          } else {
            const cat = categories.find((c) => c.categoryId === i.inventoryCategoryId);
            if (cat) gName = cat.categoryName;
          }
          return gName === selectedGroup && !removedLines.includes(i.inventoryName);
        })
        .reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
    }

    return processedItems
      .filter((i) => !removedLines.includes(i.inventoryName))
      .reduce((acc, curr) => acc + (curr.closingValue || 0), 0);
  }, [processedItems, removedLines, currentScreen, selectedGroup, grouping, groups, categories]);

  // Monthly summary breakdown details
  const monthlyData = useMemo(() => {
    if (selectedItemId === null) return [];

    const item = processedItems.find((i) => i.inventoryId === selectedItemId);
    if (!item) return [];

    const itemMovements = movements.filter((m) => m.inventoryId === selectedItemId);

    const startDateObj = new Date(fromParam);
    const startYear = startDateObj.getFullYear();
    const fyStartYear = startDateObj.getMonth() >= 3 ? startYear : startYear - 1;

    const months = [
      { name: "April", year: fyStartYear, monthIndex: 3 },
      { name: "May", year: fyStartYear, monthIndex: 4 },
      { name: "June", year: fyStartYear, monthIndex: 5 },
      { name: "July", year: fyStartYear, monthIndex: 6 },
      { name: "August", year: fyStartYear, monthIndex: 7 },
      { name: "September", year: fyStartYear, monthIndex: 8 },
      { name: "October", year: fyStartYear, monthIndex: 9 },
      { name: "November", year: fyStartYear, monthIndex: 10 },
      { name: "December", year: fyStartYear, monthIndex: 11 },
      { name: "January", year: fyStartYear + 1, monthIndex: 0 },
      { name: "February", year: fyStartYear + 1, monthIndex: 1 },
      { name: "March", year: fyStartYear + 1, monthIndex: 2 },
    ];

    let runningQty = item.openingQty;
    let runningValue = item.openingValue;

    const opQtyConfig = item.openingStockQty;
    const opRateConfig = item.openingStockRate;

    let totalInwardQtyUpToTo = opQtyConfig;
    let totalInwardValueUpToTo = opQtyConfig * opRateConfig;

    itemMovements.forEach((m) => {
      const qty = m.quantity;
      const rate = m.rate;
      const amount = m.amount;
      const dateStr = m.voucherDate;

      const isInward =
        m.movementType === "purchase" ||
        m.movementType === "opening" ||
        (m.movementType === "adjustment" && qty >= 0);

      const currentQty = Math.abs(qty);
      const currentValue = amount > 0 ? amount : currentQty * (rate > 0 ? rate : opRateConfig);

      if (dateStr < fromParam && isInward) {
        totalInwardQtyUpToTo += currentQty;
        totalInwardValueUpToTo += currentValue;
      }
    });

    return months.map((m) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const monthStartStr = `${m.year}-${pad(m.monthIndex + 1)}-01`;
      const nextMonthObj = new Date(m.year, m.monthIndex + 1, 1);
      const monthEndStr = new Date(nextMonthObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      let monthlyInQty = 0;
      let monthlyInValue = 0;
      let monthlyOutQty = 0;
      let monthlyOutValue = 0;

      const currentMonthMovements = itemMovements.filter(
        (mov) => mov.voucherDate >= monthStartStr && mov.voucherDate <= monthEndStr
      );

      currentMonthMovements.forEach((mov) => {
        const qty = mov.quantity;
        const rate = mov.rate;
        const amount = mov.amount;

        const isInward =
          mov.movementType === "purchase" ||
          mov.movementType === "opening" ||
          (mov.movementType === "adjustment" && qty >= 0);

        const currentQty = Math.abs(qty);
        const currentValue = amount > 0 ? amount : currentQty * (rate > 0 ? rate : opRateConfig);

        if (isInward) {
          monthlyInQty += currentQty;
          monthlyInValue += currentValue;
          totalInwardQtyUpToTo += currentQty;
          totalInwardValueUpToTo += currentValue;
        } else {
          monthlyOutQty += currentQty;
          monthlyOutValue += amount > 0 ? amount : currentQty * rate;
        }
      });

      const startQty = runningQty;
      const startValue = runningValue;

      runningQty = runningQty + monthlyInQty - monthlyOutQty;

      const monthlyAvgInwardRate =
        totalInwardQtyUpToTo > 0 ? totalInwardValueUpToTo / totalInwardQtyUpToTo : opRateConfig;

      runningValue = runningQty * monthlyAvgInwardRate;

      return {
        name: m.name,
        year: m.year,
        monthIndex: m.monthIndex,
        openingQty: startQty,
        openingValue: startValue,
        inwardQty: monthlyInQty,
        inwardValue: monthlyInValue,
        outwardQty: monthlyOutQty,
        outwardValue: monthlyOutValue,
        closingQty: runningQty,
        closingValue: runningQty >= 0 ? runningValue : null,
      };
    });
  }, [selectedItemId, processedItems, movements, fromParam]);

  const selectedItemDetails = useMemo(() => {
    return processedItems.find((i) => i.inventoryId === selectedItemId) || null;
  }, [processedItems, selectedItemId]);

  const triggerPrint = () => {
    window.print();
  };

  const downloadCSV = () => {
    if (!canExport) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Particulars,Closing Quantity,Rate,Closing Value\n";

    groupedData.forEach((g) => {
      if (grouping !== "none") {
        csvContent += `"${g.groupName.toUpperCase()}",,,\n`;
      }
      g.items.forEach((item) => {
        csvContent += `"${item.inventoryName}","${item.closingQty.toFixed(2)} ${item.unit}","${
          item.closingRate ? item.closingRate.toFixed(2) : ""
        }","${item.closingValue ? item.closingValue.toFixed(2) : ""}"\n`;
      });
    });

    csvContent += `GRAND TOTAL,,,${totalValueSum.toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_summary_${fromParam}_to_${toParam}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Print settings block to hide standard browser URL titles/dates and side navs */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 0mm;
          }
          body {
            margin: 0mm !important;
            background-color: white !important;
          }
          .no-print {
            display: none !important;
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
      `}} />

      {/* Main Title bar and action controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {currentScreen === "summary" && "Stock Summary"}
            {currentScreen === "groupSummary" && `Stock Group Summary: ${selectedGroup}`}
            {currentScreen === "monthly" && `Stock Item Monthly Summary`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentScreen === "summary" ? (
            <>
              {/* Grouping Select Button Group */}
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <Button
                  variant={grouping === "group" ? "default" : "outline"}
                  onClick={() => setGrouping("group")}
                  className="rounded-r-none border-r-0"
                >
                  Group
                </Button>
                <Button
                  variant={grouping === "category" ? "default" : "outline"}
                  onClick={() => setGrouping("category")}
                  className="rounded-none border-r-0"
                >
                  Category
                </Button>
                <Button
                  variant={grouping === "none" ? "default" : "outline"}
                  onClick={() => setGrouping("none")}
                  className="rounded-l-none"
                >
                  Flat List
                </Button>
              </div>

              {/* Condensed/Detailed view toggle */}
              <Button
                variant="outline"
                onClick={() => setIsDetailed(!isDetailed)}
                className="flex items-center gap-2"
              >
                {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {isDetailed ? "Condensed" : "Detailed"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                if (currentScreen === "monthly") {
                  setCurrentScreen(selectedGroup ? "groupSummary" : "summary");
                } else if (currentScreen === "groupSummary") {
                  setCurrentScreen("summary");
                }
              }}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {/* Select period */}
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          {/* Export options */}
          {canExport && currentScreen === "summary" && (
            <Button variant="outline" onClick={downloadCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Excel/CSV
            </Button>
          )}

          {/* Save as PDF */}
          <Button onClick={triggerPrint} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm p-6">
        {/* Printable report header */}
        <div className="text-center py-4 border-b border-border bg-card mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            {currentScreen === "summary" && "Stock Summary"}
            {currentScreen === "groupSummary" && `Stock Group Summary: ${selectedGroup}`}
            {currentScreen === "monthly" && `Stock Item Monthly Summary: ${selectedItemDetails?.inventoryName}`}
          </p>
          {currentScreen === "monthly" && (
            <p className="text-[10px] text-primary font-medium normal-case mt-1 no-print">
              * Click on any month row to view detailed transaction-level stock movements
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* SCREEN 1: Stock Summary */}
        {currentScreen === "summary" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-border">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th rowSpan={2} className="p-3 text-left border-r border-border font-bold text-foreground">Particulars</th>
                  <th colSpan={3} className="p-2 text-center border-b border-border">Closing Balance</th>
                </tr>
                <tr className="bg-muted/20 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-2 text-right border-l border-r border-border w-[20%]">Quantity</th>
                  <th className="p-2 text-right border-r border-border w-[15%] italic">Rate</th>
                  <th className="p-2 text-right w-[20%]">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {groupedData.map((g) => {
                  const groupNameKey = g.groupName;
                  const isGroupExpanded = expandedGroups[groupNameKey] ?? isDetailed;
                  const groupValue = g.items.reduce((s, item) => s + (item.closingValue || 0), 0);

                  return (
                    <React.Fragment key={groupNameKey}>
                      {/* Group Header Row */}
                      {grouping !== "none" && (
                        <tr className="bg-muted/15 hover:bg-muted/20 font-bold border-b border-border text-foreground transition-colors">
                          <td className="p-3 text-left border-r border-border">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleGroupExpand(g.groupName)}
                                className="p-1 hover:bg-muted rounded no-print text-muted-foreground border-0 bg-transparent cursor-pointer"
                              >
                                {isGroupExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              <span
                                onClick={() => {
                                  setSelectedGroup(g.groupName);
                                  setCurrentScreen("groupSummary");
                                }}
                                className="hover:underline hover:text-primary cursor-pointer uppercase tracking-wider"
                              >
                                {g.groupName}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 border-r border-border"></td>
                          <td className="p-2 border-r border-border"></td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            {groupValue > 0 ? formatAmount(groupValue) : "—"}
                          </td>
                        </tr>
                      )}

                      {/* Items under this group */}
                      {isGroupExpanded &&
                        g.items.map((item) => (
                          <tr
                            key={item.inventoryId}
                            onClick={() => {
                              setSelectedItemId(item.inventoryId);
                              setCurrentScreen("monthly");
                            }}
                            className="hover:bg-muted/10 cursor-pointer border-b border-border/40 text-xs transition-colors"
                          >
                            <td className={`p-2 text-left border-r border-border text-foreground font-medium ${
                              grouping !== "none" ? "pl-8" : "pl-3"
                            }`}>
                              <div className="flex justify-between items-center group/row">
                                <span>{item.inventoryName}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveLine(item.inventoryName);
                                  }}
                                  className="opacity-0 group-hover/row:opacity-100 text-[10px] text-destructive hover:underline p-1 ml-2 no-print border-0 bg-transparent cursor-pointer"
                                >
                                  Omit
                                </button>
                              </div>
                            </td>
                            <td className="p-2 text-right border-r border-border font-mono text-foreground font-semibold">
                              {formatQty(item.closingQty, item.unit)}
                            </td>
                            <td className="p-2 text-right border-r border-border font-mono text-muted-foreground italic">
                              {item.closingRate !== null ? formatAmount(item.closingRate) : "—"}
                            </td>
                            <td className="p-2 text-right font-mono text-foreground font-bold">
                              {item.closingValue !== null ? formatAmount(item.closingValue) : "—"}
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                {/* Total Row with standard double lines */}
                <tr className="border-t-2 border-b-2 border-border font-bold bg-muted/20 text-sm">
                  <td className="p-3 text-left font-bold border-r border-border text-foreground">Grand Total</td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-3 text-right font-mono font-bold text-foreground text-base">
                    {formatAmount(totalValueSum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* SCREEN 2: Stock Group Summary */}
        {currentScreen === "groupSummary" && selectedGroup && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-border">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th rowSpan={2} className="p-3 text-left border-r border-border font-bold text-foreground">Particulars</th>
                  <th colSpan={3} className="p-2 text-center border-b border-border">Closing Balance</th>
                </tr>
                <tr className="bg-muted/20 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="p-2 text-right border-l border-r border-border w-[20%]">Quantity</th>
                  <th className="p-2 text-right border-r border-border w-[15%] italic">Rate</th>
                  <th className="p-2 text-right w-[20%]">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(() => {
                  const itemsInGroup = processedItems.filter((i) => {
                    let gName = "";
                    if (grouping === "group") {
                      const grp = groups.find((g) => g.groupId === i.inventoryGroupId);
                      if (grp) gName = grp.groupName;
                    } else {
                      const cat = categories.find((c) => c.categoryId === i.inventoryCategoryId);
                      if (cat) gName = cat.categoryName;
                    }
                    return gName === selectedGroup && !removedLines.includes(i.inventoryName);
                  });

                  return itemsInGroup.map((item) => (
                    <tr
                      key={item.inventoryId}
                      onClick={() => {
                        setSelectedItemId(item.inventoryId);
                        setCurrentScreen("monthly");
                      }}
                      className="hover:bg-muted/10 cursor-pointer border-b border-border/40 text-xs transition-colors"
                    >
                      <td className="p-3 text-left border-r border-border text-foreground font-semibold pl-3">
                        <div className="flex justify-between items-center group/row">
                          <span>{item.inventoryName}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveLine(item.inventoryName);
                            }}
                            className="opacity-0 group-hover/row:opacity-100 text-[10px] text-destructive hover:underline p-1 ml-2 no-print border-0 bg-transparent cursor-pointer"
                          >
                            Omit
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-right border-r border-border font-mono text-foreground font-semibold">
                        {formatQty(item.closingQty, item.unit)}
                      </td>
                      <td className="p-2 text-right border-r border-border font-mono text-muted-foreground italic">
                        {item.closingRate !== null ? formatAmount(item.closingRate) : "—"}
                      </td>
                      <td className="p-2 text-right font-mono text-foreground font-bold">
                        {item.closingValue !== null ? formatAmount(item.closingValue) : "—"}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                {/* Total Row */}
                <tr className="border-t-2 border-b-2 border-border font-bold bg-muted/20 text-sm">
                  <td className="p-3 text-left font-bold border-r border-border text-foreground">Grand Total</td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-2 border-r border-border"></td>
                  <td className="p-3 text-right font-mono font-bold text-foreground text-base">
                    {formatAmount(totalValueSum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* SCREEN 3: Stock Item Monthly Summary */}
        {currentScreen === "monthly" && (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  {/* Primary Headers */}
                  <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="p-3 text-left w-1/4 border-r border-border">Particulars</th>
                    <th colSpan={2} className="p-3 text-center border-r border-border">Inwards</th>
                    <th colSpan={2} className="p-3 text-center border-r border-border">Outwards</th>
                    <th colSpan={2} className="p-3 text-center">Closing Balance</th>
                  </tr>
                  {/* Secondary Headers */}
                  <tr className="border-b border-border bg-muted/20 text-[10px] uppercase font-bold text-muted-foreground">
                    <th className="p-2 text-left border-r border-border"></th>
                    <th className="p-2 text-right border-r border-border">Quantity</th>
                    <th className="p-2 text-right border-r border-border">Value</th>
                    <th className="p-2 text-right border-r border-border">Quantity</th>
                    <th className="p-2 text-right border-r border-border">Value</th>
                    <th className="p-2 text-right border-r border-border">Quantity</th>
                    <th className="p-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* Opening Balance Row */}
                  <tr className="bg-muted/10 font-semibold border-b border-border/80 text-xs">
                    <td className="p-2 text-foreground italic border-r border-border">Opening Balance</td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 border-r border-border"></td>
                    <td className="p-2 text-right text-foreground font-mono border-r border-border font-semibold">
                      {selectedItemDetails ? formatQty(selectedItemDetails.openingQty, selectedItemDetails.unit) : ""}
                    </td>
                    <td className="p-2 text-right text-foreground font-mono font-semibold">
                      {selectedItemDetails ? formatAmount(selectedItemDetails.openingValue) : ""}
                    </td>
                  </tr>

                  {/* Monthly rows */}
                  {monthlyData.map((m) => (
                    <tr
                      key={m.name}
                      onClick={() => {
                        if (selectedItemId !== null) {
                          const pad = (n: number) => String(n).padStart(2, "0");
                          const fromStr = `${m.year}-${pad(m.monthIndex + 1)}-01`;
                          const lastDay = new Date(m.year, m.monthIndex + 1, 0);
                          const toStr = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
                          router.push(`/dashboard/stock-movements?inventoryId=${selectedItemId}&from=${fromStr}&to=${toStr}`);
                        }
                      }}
                      className="hover:bg-muted/15 text-xs border-b border-border/40 transition-colors cursor-pointer"
                      title="Click to view detailed movements"
                    >
                      <td className="p-2 font-medium text-foreground border-r border-border">{m.name}</td>
                      <td className="p-2 text-right font-mono border-r border-border text-foreground">
                        {m.inwardQty > 0 ? formatQty(m.inwardQty, selectedItemDetails?.unit || "") : "—"}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-border text-muted-foreground">
                        {m.inwardQty > 0 ? formatAmount(m.inwardValue) : "—"}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-border text-foreground">
                        {m.outwardQty > 0 ? formatQty(m.outwardQty, selectedItemDetails?.unit || "") : "—"}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-border text-muted-foreground">
                        {m.outwardQty > 0 ? formatAmount(m.outwardValue) : "—"}
                      </td>
                      <td className="p-2 text-right font-mono border-r border-border text-foreground">
                        {formatQty(m.closingQty, selectedItemDetails?.unit || "")}
                      </td>
                      <td className="p-2 text-right font-mono text-foreground font-semibold">
                        {m.closingValue !== null ? formatAmount(m.closingValue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Grand Totals */}
                  <tr className="border-t-2 border-b-2 border-border font-bold bg-muted/20 text-xs">
                    <td className="p-2.5 text-foreground uppercase border-r border-border font-bold">Grand Total</td>
                    <td className="p-2 text-right font-mono border-r border-border text-foreground font-bold">
                      {formatQty(monthlyData.reduce((s, m) => s + m.inwardQty, 0), selectedItemDetails?.unit || "")}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border text-foreground font-bold">
                      {formatAmount(monthlyData.reduce((s, m) => s + m.inwardValue, 0))}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border text-foreground font-bold">
                      {formatQty(monthlyData.reduce((s, m) => s + m.outwardQty, 0), selectedItemDetails?.unit || "")}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border text-foreground font-bold">
                      {formatAmount(monthlyData.reduce((s, m) => s + m.outwardValue, 0))}
                    </td>
                    <td className="p-2 text-right font-mono border-r border-border text-foreground font-bold">
                      {selectedItemDetails ? formatQty(selectedItemDetails.closingQty, selectedItemDetails.unit) : ""}
                    </td>
                    <td className="p-2 text-right font-mono text-foreground font-bold text-sm">
                      {selectedItemDetails && selectedItemDetails.closingValue !== null ? formatAmount(selectedItemDetails.closingValue) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Recharts Outwards Quantity visual bar graph */}
            <div className="pt-6 border-t border-border space-y-4">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Monthly Outwards Quantity Visualizer
              </span>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData.map((m) => ({
                      name: m.name.substring(0, 3),
                      Outwards: m.outwardQty,
                    }))}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-xs text-muted-foreground" />
                    <YAxis stroke="currentColor" className="text-xs text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--foreground)",
                      }}
                    />
                    <Bar
                      dataKey="Outwards"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Omitted elements warning panel */}
      {removedLines.length > 0 && (
        <div className="p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
          <span>
            You have hidden <strong>{removedLines.length}</strong> items from the report structure. The sheet remains mathematically balanced.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRestoreLine}>
              Restore Last
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/25 hover:bg-destructive/10"
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

      {/* Period Selection Modal Dialog */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px] no-print">
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
            <Button onClick={handleApplyPeriod}>
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StockSummaryClient(props: StockSummaryClientProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Stock Summary...</div>}>
      <StockSummaryContent {...props} />
    </Suspense>
  );
}
