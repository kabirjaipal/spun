"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Calendar, ArrowLeft, RefreshCw, X, ChevronDown, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}

interface InventoryItem {
  inventoryId: number;
  inventoryName: string;
  unit: string;
  openingStockQty: number;
  openingStockRate: number;
}

interface StockMovement {
  stockMovementId: number;
  inventoryId: number;
  inventoryName: string;
  unit: string;
  voucherId: number | null;
  movementType: string;
  quantity: number;
  rate: number;
  amount: number;
  voucherDate: string;
  voucherNo: string | null;
  voucherType: string | null;
}

interface StockMovementsClientProps {
  company: Company;
  items: InventoryItem[];
  movements: StockMovement[];
  canExport: boolean;
}

function StockMovementsContent({
  company,
  items,
  movements,
  canExport,
}: StockMovementsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Period settings from URL or standard defaults
  const fyStartYear = useMemo(() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return m >= 3 ? y : y - 1;
  }, []);

  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;
  const itemParam = searchParams.get("inventoryId") || "";

  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [selectedItemId, setSelectedItemId] = useState<string>(itemParam);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const [monthlyView, setMonthlyView] = useState(!!itemParam);
  const [selectedMonth, setSelectedMonth] = useState<any | null>(null);

  useEffect(() => {
    setMonthlyView(!!selectedItemId);
  }, [selectedItemId]);

  const monthlySummary = useMemo(() => {
    if (!selectedItemId) return [];

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

    const item = items.find((i) => String(i.inventoryId) === selectedItemId);
    let runningQty = item ? Number(item.openingStockQty || 0) : 0;
    let runningVal = item ? Number(item.openingStockQty || 0) * Number(item.openingStockRate || 0) : 0;

    return monthsList.map((month) => {
      const monthMovements = movements.filter(
        (m) => String(m.voucherDate).slice(0, 7) === month.key
      );

      let inwardQty = 0;
      let inwardValue = 0;
      let outwardQty = 0;
      let outwardValue = 0;

      monthMovements.forEach((m) => {
        const isInward =
          m.movementType === "purchase" ||
          m.movementType === "opening" ||
          (m.movementType === "adjustment" && m.quantity >= 0);

        if (isInward) {
          inwardQty += m.quantity;
          inwardValue += m.amount;
        } else {
          outwardQty += Math.abs(m.quantity);
          outwardValue += m.amount;
        }
      });

      runningQty += (inwardQty - outwardQty);
      runningVal += (inwardValue - outwardValue);

      return {
        monthKey: month.key,
        monthName: month.monthName,
        year: month.year,
        inwardQty,
        inwardValue,
        outwardQty,
        outwardValue,
        closingQty: runningQty,
        closingValue: runningVal,
        movements: monthMovements,
      };
    });
  }, [startDate, endDate, movements, selectedItemId, items]);

  const selectedMonthTotals = useMemo(() => {
    if (!selectedMonth) return { inwardQtySum: 0, outwardQtySum: 0, inwardValueSum: 0, outwardValueSum: 0 };
    let inwardQtySum = 0;
    let outwardQtySum = 0;
    let inwardValueSum = 0;
    let outwardValueSum = 0;

    selectedMonth.movements.forEach((m: any) => {
      const isInward = m.movementType === "purchase" || m.movementType === "opening" || (m.movementType === "adjustment" && m.quantity >= 0);
      if (isInward) {
        inwardQtySum += m.quantity;
        inwardValueSum += m.amount;
      } else {
        outwardQtySum += Math.abs(m.quantity);
        outwardValueSum += m.amount;
      }
    });

    return { inwardQtySum, outwardQtySum, inwardValueSum, outwardValueSum };
  }, [selectedMonth]);

  // Search input inside item dropdown
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const selectedItemName = useMemo(() => {
    if (!selectedItemId) return "All Items";
    const found = items.find((i) => String(i.inventoryId) === selectedItemId);
    return found ? found.inventoryName : "All Items";
  }, [selectedItemId, items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.inventoryName.toLowerCase().includes(itemSearch.toLowerCase())
    );
  }, [items, itemSearch]);

  const handleApplyFilters = (newFrom = startDate, newTo = endDate, newItem = selectedItemId) => {
    const params = new URLSearchParams();
    if (newFrom) params.set("from", newFrom);
    if (newTo) params.set("to", newTo);
    if (newItem) params.set("inventoryId", newItem);
    router.push(`?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setStartDate(`${fyStartYear}-04-01`);
    setEndDate(`${fyStartYear + 1}-03-31`);
    setSelectedItemId("");
    setItemSearch("");
    router.push(`?from=${fyStartYear}-04-01&to=${fyStartYear + 1}-03-31`);
  };

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatQty = (val: number, unit: string) => {
    return `${new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)} ${unit}`;
  };

  const triggerPrint = () => {
    window.print();
  };

  // CSV Export handler
  const handleExportCSV = () => {
    if (!canExport) return;
    let csv = "data:text/csv;charset=utf-8,";
    csv += "Date,Voucher No,Voucher Type,Item Name,Movement,Inward Qty,Inward Value,Outward Qty,Outward Value,Rate\n";

    movements.forEach((m) => {
      const isInward = m.movementType === "purchase" || m.movementType === "opening" || (m.movementType === "adjustment" && m.quantity >= 0);
      const inwardQtyStr = isInward ? m.quantity.toFixed(2) : "";
      const inwardValueStr = isInward ? m.amount.toFixed(2) : "";
      const outwardQtyStr = !isInward ? Math.abs(m.quantity).toFixed(2) : "";
      const outwardValueStr = !isInward ? m.amount.toFixed(2) : "";
      csv += `"${m.voucherDate}","${m.voucherNo || "N/A"}","${m.voucherType || "N/A"}","${m.inventoryName}","${m.movementType}","${inwardQtyStr}","${inwardValueStr}","${outwardQtyStr}","${outwardValueStr}","${m.rate.toFixed(2)}"\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_movements_${fromParam}_to_${toParam}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grand totals of the table
  const totals = useMemo(() => {
    let inwardQtySum = 0;
    let outwardQtySum = 0;
    let inwardValueSum = 0;
    let outwardValueSum = 0;

    movements.forEach((m) => {
      const isInward = m.movementType === "purchase" || m.movementType === "opening" || (m.movementType === "adjustment" && m.quantity >= 0);
      if (isInward) {
        inwardQtySum += m.quantity;
        inwardValueSum += m.amount;
      } else {
        outwardQtySum += Math.abs(m.quantity);
        outwardValueSum += m.amount;
      }
    });

    return { inwardQtySum, outwardQtySum, inwardValueSum, outwardValueSum };
  }, [movements]);

  return (
    <div className="space-y-6">
      {/* Clean print styling override to hide headers and footers from browser print dialogs */}
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

      {/* Action panel & Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Stock Movements</h1>
        </div>

        {/* Filters and buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Searchable Item dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowItemDropdown(!showItemDropdown)}
              className="flex items-center gap-2 w-48 justify-between text-left font-normal"
            >
              <span className="truncate">{selectedItemName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
            {showItemDropdown && (
              <div className="absolute right-0 mt-1 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 p-2">
                <Input
                  placeholder="Search stock item..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="mb-2 h-8 text-xs"
                />
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  <div
                    onClick={() => {
                      setSelectedItemId("");
                      setShowItemDropdown(false);
                      handleApplyFilters(startDate, endDate, "");
                    }}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted ${
                      !selectedItemId ? "bg-muted font-bold" : ""
                    }`}
                  >
                    <span>All Items</span>
                    {!selectedItemId && <Check className="h-3 w-3" />}
                  </div>
                  {filteredItems.map((item) => (
                    <div
                      key={item.inventoryId}
                      onClick={() => {
                        setSelectedItemId(String(item.inventoryId));
                        setShowItemDropdown(false);
                        handleApplyFilters(startDate, endDate, String(item.inventoryId));
                      }}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted ${
                        selectedItemId === String(item.inventoryId) ? "bg-muted font-bold" : ""
                      }`}
                    >
                      <span className="truncate">{item.inventoryName}</span>
                      {selectedItemId === String(item.inventoryId) && <Check className="h-3 w-3" />}
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="p-2 text-center text-muted-foreground">No items found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedItemId && (
            <Button
              variant="outline"
              onClick={() => setMonthlyView(!monthlyView)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {monthlyView ? "Detailed View" : "Monthly Summary"}
            </Button>
          )}

          {/* Date range button */}
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          {/* Clear filters button */}
          {(selectedItemId || startDate !== `${fyStartYear}-04-01` || endDate !== `${fyStartYear + 1}-03-31`) && (
            <Button variant="outline" onClick={handleResetFilters} className="text-destructive hover:bg-destructive/10">
              Clear
            </Button>
          )}

          {/* Export options */}
          {canExport && (
            <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              CSV
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
            Stock Movements Report {selectedItemId ? ` - ${selectedItemName}` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Period: {new Date(fromParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(toParam).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {monthlyView ? (
          /* MONTHLY SUMMARY TABLE */
          <table className="w-full text-sm border-collapse border border-border">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left border-r border-border font-bold text-foreground" rowSpan={2}>Particulars (Month)</th>
                <th className="p-2 text-center border-r border-border font-bold text-foreground" colSpan={2}>Inwards</th>
                <th className="p-2 text-center border-r border-border font-bold text-foreground" colSpan={2}>Outwards</th>
                <th className="p-2 text-center font-bold text-foreground" colSpan={2}>Closing Balance</th>
              </tr>
              <tr className="bg-muted/20 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-2 text-right border-r border-border font-semibold text-foreground">Quantity</th>
                <th className="p-2 text-right border-r border-border font-semibold text-foreground">Value</th>
                <th className="p-2 text-right border-r border-border font-semibold text-foreground">Quantity</th>
                <th className="p-2 text-right border-r border-border font-semibold text-foreground">Value</th>
                <th className="p-2 text-right border-r border-border font-semibold text-foreground">Quantity</th>
                <th className="p-2 text-right font-semibold text-foreground">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {monthlySummary.map((item) => {
                const unit = movements[0]?.unit || "pcs";
                return (
                  <tr
                    key={item.monthKey}
                    onClick={() => setSelectedMonth(item)}
                    className="hover:bg-muted/10 text-xs transition-colors cursor-pointer"
                  >
                    <td className="p-2.5 border-r border-border text-foreground font-semibold">
                      {item.monthName} {item.year}
                    </td>
                    <td className="p-2.5 text-right border-r border-border font-mono font-medium">
                      {item.inwardQty > 0 ? formatQty(item.inwardQty, unit) : "—"}
                    </td>
                    <td className="p-2.5 text-right border-r border-border font-mono text-emerald-600 font-medium">
                      {item.inwardValue > 0 ? `₹${formatAmount(item.inwardValue)}` : "—"}
                    </td>
                    <td className="p-2.5 text-right border-r border-border font-mono font-medium">
                      {item.outwardQty > 0 ? formatQty(item.outwardQty, unit) : "—"}
                    </td>
                    <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 font-medium">
                      {item.outwardValue > 0 ? `₹${formatAmount(item.outwardValue)}` : "—"}
                    </td>
                    <td className="p-2.5 text-right border-r border-border font-mono font-bold">
                      {formatQty(item.closingQty, unit)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      ₹{formatAmount(item.closingValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-b-4 border-double border-border font-bold bg-muted/20 text-xs">
                <td className="p-3 text-left font-bold border-r border-border text-foreground">
                  Grand Total
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-foreground font-bold">
                  {totals.inwardQtySum > 0 ? formatQty(totals.inwardQtySum, movements[0]?.unit || "pcs") : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-emerald-600 font-bold">
                  ₹{formatAmount(monthlySummary.reduce((sum, item) => sum + item.inwardValue, 0))}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-foreground font-bold">
                  {totals.outwardQtySum > 0 ? formatQty(totals.outwardQtySum, movements[0]?.unit || "pcs") : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-amber-600 font-bold">
                  ₹{formatAmount(monthlySummary.reduce((sum, item) => sum + item.outwardValue, 0))}
                </td>
                <td className="p-2 text-right border-r border-border font-mono font-bold text-foreground">
                  {monthlySummary.length > 0 ? formatQty(monthlySummary[monthlySummary.length - 1].closingQty, movements[0]?.unit || "pcs") : "—"}
                </td>
                <td className="p-3 text-right font-mono font-bold text-foreground text-sm">
                  ₹{formatAmount(monthlySummary.length > 0 ? monthlySummary[monthlySummary.length - 1].closingValue : 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          /* DETAILED VIEW TABLE */
          <table className="w-full text-sm border-collapse border border-border">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left border-r border-border w-[10%] font-bold text-foreground">Date</th>
                <th className="p-3 text-left border-r border-border w-[12%] font-bold text-foreground">Voucher No</th>
                <th className="p-3 text-left border-r border-border w-[12%] font-bold text-foreground">Voucher Type</th>
                <th className="p-3 text-left border-r border-border font-bold text-foreground">Item Name</th>
                <th className="p-3 text-left border-r border-border w-[8%] font-bold text-foreground">Type</th>
                <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Inward Qty</th>
                <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Inward Value</th>
                <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Outward Qty</th>
                <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Outward Value</th>
                <th className="p-3 text-right w-[8%] font-bold text-foreground">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">
                    No movements recorded in this period.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isInward =
                    m.movementType === "purchase" ||
                    m.movementType === "opening" ||
                    (m.movementType === "adjustment" && m.quantity >= 0);

                  return (
                    <tr key={m.stockMovementId} className="hover:bg-muted/10 text-xs transition-colors">
                      <td className="p-2.5 border-r border-border text-foreground">
                        {new Date(m.voucherDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2.5 border-r border-border font-medium text-foreground">
                        {m.voucherNo || "—"}
                      </td>
                      <td className="p-2.5 border-r border-border uppercase tracking-wide text-muted-foreground">
                        {m.voucherType || "—"}
                      </td>
                      <td className="p-2.5 border-r border-border font-semibold text-foreground truncate max-w-xs">
                        {m.inventoryName}
                      </td>
                      <td className="p-2.5 border-r border-border uppercase tracking-widest text-[10px] font-bold text-muted-foreground">
                        {m.movementType}
                      </td>
                      <td className="p-2.5 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-semibold">
                        {isInward ? formatQty(m.quantity, m.unit) : "—"}
                      </td>
                      <td className="p-2.5 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-semibold">
                        {isInward ? `₹${formatAmount(m.amount)}` : "—"}
                      </td>
                      <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-semibold">
                        {!isInward ? formatQty(Math.abs(m.quantity), m.unit) : "—"}
                      </td>
                      <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-semibold">
                        {!isInward ? `₹${formatAmount(m.amount)}` : "—"}
                      </td>
                      <td className="p-2.5 text-right font-mono text-muted-foreground">
                        {m.rate > 0 ? `₹${formatAmount(m.rate)}` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-b-4 border-double border-border font-bold bg-muted/20 text-xs">
                <td colSpan={5} className="p-3 text-left font-bold border-r border-border text-foreground">
                  Grand Total
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-bold">
                  {totals.inwardQtySum > 0 ? formatQty(totals.inwardQtySum, movements[0]?.unit || "pcs") : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-bold">
                  {totals.inwardValueSum > 0 ? `₹${formatAmount(totals.inwardValueSum)}` : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-bold">
                  {totals.outwardQtySum > 0 ? formatQty(totals.outwardQtySum, movements[0]?.unit || "pcs") : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-bold">
                  {totals.outwardValueSum > 0 ? `₹${formatAmount(totals.outwardValueSum)}` : "—"}
                </td>
                <td className="p-3 border-0"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Date Period selector Dialog */}
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
            <Button onClick={() => { setShowPeriodModal(false); handleApplyFilters(startDate, endDate); }}>
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly movements drill-down dialog */}
      <Dialog open={selectedMonth !== null} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Stock Movements — {selectedMonth?.monthName} {selectedMonth?.year} ({selectedItemName})
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="p-3 text-left border-r border-border w-[10%] font-bold text-foreground">Date</th>
                    <th className="p-3 text-left border-r border-border w-[12%] font-bold text-foreground">Voucher No</th>
                    <th className="p-3 text-left border-r border-border w-[12%] font-bold text-foreground">Voucher Type</th>
                    <th className="p-3 text-left border-r border-border font-bold text-foreground">Item Name</th>
                    <th className="p-3 text-left border-r border-border w-[8%] font-bold text-foreground">Type</th>
                    <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Inward Qty</th>
                    <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Inward Value</th>
                    <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Outward Qty</th>
                    <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Outward Value</th>
                    <th className="p-3 text-right w-[8%] font-bold text-foreground">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {selectedMonth?.movements.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">
                        No movements recorded in this month.
                      </td>
                    </tr>
                  ) : (
                    selectedMonth?.movements.map((m: any) => {
                      const isInward =
                        m.movementType === "purchase" ||
                        m.movementType === "opening" ||
                        (m.movementType === "adjustment" && m.quantity >= 0);

                      return (
                        <tr key={m.stockMovementId} className="hover:bg-muted/10 text-xs transition-colors">
                          <td className="p-2.5 border-r border-border text-foreground">
                            {new Date(m.voucherDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="p-2.5 border-r border-border font-medium text-foreground">
                            {m.voucherNo || "—"}
                          </td>
                          <td className="p-2.5 border-r border-border uppercase tracking-wide text-muted-foreground">
                            {m.voucherType || "—"}
                          </td>
                          <td className="p-2.5 border-r border-border font-semibold text-foreground truncate max-w-xs">
                            {m.inventoryName}
                          </td>
                          <td className="p-2.5 border-r border-border uppercase tracking-widest text-[10px] font-bold text-muted-foreground">
                            {m.movementType}
                          </td>
                          <td className="p-2.5 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-semibold">
                            {isInward ? formatQty(m.quantity, m.unit) : "—"}
                          </td>
                          <td className="p-2.5 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-semibold">
                            {isInward ? `₹${formatAmount(m.amount)}` : "—"}
                          </td>
                          <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-semibold">
                            {!isInward ? formatQty(Math.abs(m.quantity), m.unit) : "—"}
                          </td>
                          <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-semibold">
                            {!isInward ? `₹${formatAmount(m.amount)}` : "—"}
                          </td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            {m.rate > 0 ? `₹${formatAmount(m.rate)}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-b-4 border-double border-border font-bold bg-muted/20 text-xs">
                    <td colSpan={5} className="p-3 text-left font-bold border-r border-border text-foreground">
                      Monthly Total
                    </td>
                    <td className="p-2 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-bold">
                      {selectedMonthTotals.inwardQtySum > 0 ? formatQty(selectedMonthTotals.inwardQtySum, selectedMonth?.movements[0]?.unit || "pcs") : "—"}
                    </td>
                    <td className="p-2 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-bold">
                      {selectedMonthTotals.inwardValueSum > 0 ? `₹${formatAmount(selectedMonthTotals.inwardValueSum)}` : "—"}
                    </td>
                    <td className="p-2 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-bold">
                      {selectedMonthTotals.outwardQtySum > 0 ? formatQty(selectedMonthTotals.outwardQtySum, selectedMonth?.movements[0]?.unit || "pcs") : "—"}
                    </td>
                    <td className="p-2 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-bold">
                      {selectedMonthTotals.outwardValueSum > 0 ? `₹${formatAmount(selectedMonthTotals.outwardValueSum)}` : "—"}
                    </td>
                    <td className="p-3 border-0"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StockMovementsClient(props: StockMovementsClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Movements</span></div>}>
      <StockMovementsContent {...props} />
    </Suspense>
  );
}
