"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface PieceMetersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pcsCount: number;
  quantityCount?: number;
  initialMeters: string[];
  onSave: (meters: string[]) => void;
}

interface PieceRow {
  pcs: string;
  meters: string;
}

export default function PieceMetersDialog({
  isOpen,
  onClose,
  pcsCount,
  quantityCount,
  initialMeters,
  onSave,
}: PieceMetersDialogProps) {
  const [rows, setRows] = useState<PieceRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialMeters && initialMeters.length > 0) {
        const parsedRows = initialMeters.map((item) => {
          if (item.includes("x")) {
            const [pcs, meters] = item.split("x");
            return { pcs, meters };
          } else {
            return { pcs: "1", meters: item };
          }
        });
        setRows(parsedRows);
      } else {
        const p = pcsCount > 0 ? String(pcsCount) : "";
        let m = "";
        if (pcsCount > 0 && quantityCount && quantityCount > 0) {
          const avg = quantityCount / pcsCount;
          m = avg % 1 === 0 ? String(avg) : avg.toFixed(2);
        }
        setRows([{ pcs: p, meters: m }]);
      }
    }
  }, [isOpen, pcsCount, quantityCount, initialMeters]);

  function handleAddRow() {
    setRows((prev) => [...prev, { pcs: "", meters: "" }]);
  }

  function handleRemoveRow(index: number) {
    if (rows.length === 1) {
      setRows([{ pcs: "", meters: "" }]);
      return;
    }
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleUpdateRow(index: number, field: keyof PieceRow, value: string) {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  }

  const summary = useMemo(() => {
    let totalPcs = 0;
    let totalMeters = 0;
    for (const r of rows) {
      const p = parseInt(r.pcs) || 0;
      const m = parseFloat(r.meters) || 0;
      totalPcs += p;
      totalMeters += p * m;
    }
    return { totalPcs, totalMeters };
  }, [rows]);

  const handleSave = () => {
    const serializedRows: string[] = [];
    for (const r of rows) {
      const p = parseInt(r.pcs) || 0;
      const m = parseFloat(r.meters) || 0;
      if (p > 0 && m > 0) {
        serializedRows.push(`${p}x${m}`);
      }
    }
    onSave(serializedRows);
  };

  const isSaveDisabled = rows.some((r) => !r.pcs || !r.meters || parseInt(r.pcs) <= 0 || parseFloat(r.meters) <= 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-[500px] w-full flex flex-col h-full p-0 gap-0">
        <SheetHeader className="px-6 py-5 border-b border-border bg-muted/30">
          <SheetTitle className="text-sm font-bold uppercase tracking-wide text-foreground">
            Enter Piece Details
          </SheetTitle>
        </SheetHeader>

        {/* SheetBody */}
        <SheetBody className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Header Row */}
          {rows.length > 0 && (
            <div className="grid grid-cols-12 gap-3 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-3">PCS Count</div>
              <div className="col-span-4">Meters per PC</div>
              <div className="col-span-4 text-right">Row Total (Mtrs)</div>
              <div className="col-span-1"></div>
            </div>
          )}

          <div className="space-y-2.5">
            {rows.map((row, index) => {
              const rowPcs = parseInt(row.pcs) || 0;
              const rowMeters = parseFloat(row.meters) || 0;
              const rowTotal = rowPcs * rowMeters;
              return (
                <div key={index} className="grid grid-cols-12 gap-3 items-center bg-muted/30 p-2 rounded-lg border border-border/40">
                  {/* PCS */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={row.pcs}
                      onChange={(e) => handleUpdateRow(index, "pcs", e.target.value)}
                      placeholder="Pcs"
                      className="h-10 text-right bg-background"
                    />
                  </div>
                  {/* Meters */}
                  <div className="col-span-4">
                    <Input
                      type="number"
                      step="0.01"
                      value={row.meters}
                      onChange={(e) => handleUpdateRow(index, "meters", e.target.value)}
                      placeholder="Meters"
                      className="h-10 text-right bg-background"
                    />
                  </div>
                  {/* Total */}
                  <div className="col-span-4 text-right font-mono text-sm font-semibold text-foreground pr-1">
                    {rowTotal > 0 ? rowTotal.toFixed(2) : "0.00"}
                  </div>
                  {/* Delete Action */}
                  <div className="col-span-1 flex justify-center">
                    <Button
                      variant="ghost"
                      type="button"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveRow(index)}
                      title="Remove Row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-10 border-dashed"
            onClick={handleAddRow}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add More Rows
          </Button>

          {/* Sheet Summary Details */}
          <div className="flex gap-4 text-xs font-mono text-left bg-muted/40 p-4 rounded-lg border border-border/50 mt-6">
            <div className="flex-1">
              <span className="text-muted-foreground uppercase text-[9px] block font-sans font-bold">Total Pieces</span>
              <span className="font-bold text-foreground text-sm">{summary.totalPcs} Pcs</span>
            </div>
            <div className="border-r border-border my-1"></div>
            <div className="flex-1">
              <span className="text-muted-foreground uppercase text-[9px] block font-sans font-bold">Total Quantity</span>
              <span className="font-bold text-foreground text-sm">{summary.totalMeters.toFixed(2)} mtr</span>
            </div>
          </div>
        </SheetBody>

        {/* SheetFooter */}
        <SheetFooter className="shrink-0 flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-6 py-5">
          <Button variant="outline" className="h-10 px-5 text-xs font-bold uppercase tracking-wider" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-10 px-6 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSave} disabled={isSaveDisabled}>
            Save Details
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
