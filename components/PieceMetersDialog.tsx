"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PieceMetersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pcsCount: number;
  initialMeters: string[];
  onSave: (meters: string[]) => void;
}

export default function PieceMetersDialog({
  isOpen,
  onClose,
  pcsCount,
  initialMeters,
  onSave,
}: PieceMetersDialogProps) {
  const [meters, setMeters] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      let initial = Array(pcsCount).fill("");
      if (initialMeters && initialMeters.length === pcsCount) {
        initial = [...initialMeters];
      }
      setMeters(initial);
    }
  }, [isOpen, pcsCount, initialMeters]);

  const totalMeters = meters.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);

  const handleSave = () => {
    onSave(meters);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold uppercase tracking-wider">
            Enter Meters for Each Piece ({pcsCount})
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 my-4 max-h-[300px] overflow-y-auto p-1">
          {meters.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground w-12">Pc {idx + 1}:</span>
              <Input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => {
                  const updated = [...meters];
                  updated[idx] = e.target.value;
                  setMeters(updated);
                }}
                placeholder="0.00"
                className="h-8 text-xs text-right"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center border-t border-border pt-3">
          <div className="text-xs font-bold uppercase">
            Total: {totalMeters.toFixed(2)} mtr
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" onClick={handleSave}>
              Save Details
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
