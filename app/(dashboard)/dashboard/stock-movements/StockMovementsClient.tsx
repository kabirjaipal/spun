"use client";

import React, { useState, useMemo, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Calendar, ArrowLeft, RefreshCw, X, ChevronDown, Check } from "lucide-react";
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
    csv += "Date,Voucher No,Voucher Type,Item Name,Movement,Inward Qty,Outward Qty,Rate,Value\n";

    movements.forEach((m) => {
      const isInward = m.movementType === "purchase" || m.movementType === "opening" || (m.movementType === "adjustment" && m.quantity >= 0);
      const inwardQtyStr = isInward ? m.quantity.toFixed(2) : "";
      const outwardQtyStr = !isInward ? Math.abs(m.quantity).toFixed(2) : "";
      csv += `"${m.voucherDate}","${m.voucherNo || "N/A"}","${m.voucherType || "N/A"}","${m.inventoryName}","${m.movementType}","${inwardQtyStr}","${outwardQtyStr}","${m.rate.toFixed(2)}","${m.amount.toFixed(2)}"\n`;
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
    let valueSum = 0;

    movements.forEach((m) => {
      const isInward = m.movementType === "purchase" || m.movementType === "opening" || (m.movementType === "adjustment" && m.quantity >= 0);
      if (isInward) {
        inwardQtySum += m.quantity;
      } else {
        outwardQtySum += Math.abs(m.quantity);
      }
      valueSum += m.amount;
    });

    return { inwardQtySum, outwardQtySum, valueSum };
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

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-border">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-left border-r border-border w-[12%] font-bold text-foreground">Date</th>
                <th className="p-3 text-left border-r border-border w-[15%] font-bold text-foreground">Voucher No</th>
                <th className="p-3 text-left border-r border-border w-[15%] font-bold text-foreground">Voucher Type</th>
                <th className="p-3 text-left border-r border-border font-bold text-foreground">Item Name</th>
                <th className="p-3 text-left border-r border-border w-[10%] font-bold text-foreground">Type</th>
                <th className="p-3 text-right border-r border-border w-[12%] font-bold text-foreground">Inward Qty</th>
                <th className="p-3 text-right border-r border-border w-[12%] font-bold text-foreground">Outward Qty</th>
                <th className="p-3 text-right border-r border-border w-[10%] font-bold text-foreground">Rate</th>
                <th className="p-3 text-right w-[12%] font-bold text-foreground">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
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
                      <td className="p-2.5 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-semibold">
                        {!isInward ? formatQty(Math.abs(m.quantity), m.unit) : "—"}
                      </td>
                      <td className="p-2.5 text-right border-r border-border font-mono text-muted-foreground">
                        {m.rate > 0 ? `₹${formatAmount(m.rate)}` : "—"}
                      </td>
                      <td className="p-2.5 text-right font-mono text-foreground font-bold">
                        ₹{formatAmount(m.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-b-2 border-border font-bold bg-muted/20 text-xs">
                <td colSpan={5} className="p-3 text-left font-bold border-r border-border text-foreground">
                  Grand Total
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-emerald-600 dark:text-emerald-500 font-bold">
                  {totals.inwardQtySum > 0 ? totals.inwardQtySum.toFixed(2) : "—"}
                </td>
                <td className="p-2 text-right border-r border-border font-mono text-amber-600 dark:text-amber-500 font-bold">
                  {totals.outwardQtySum > 0 ? totals.outwardQtySum.toFixed(2) : "—"}
                </td>
                <td className="p-2 border-r border-border"></td>
                <td className="p-3 text-right font-mono font-bold text-foreground text-sm">
                  ₹{formatAmount(totals.valueSum)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
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
