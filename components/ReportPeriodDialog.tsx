"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onApply: () => void;
}

export function ReportPeriodDialog({
  open,
  onOpenChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
}: ReportPeriodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Report Period</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="from" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              From Date
            </Label>
            <Input
              id="from"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="col-span-3 h-10 text-sm bg-background border-border"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              To Date
            </Label>
            <Input
              id="to"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="col-span-3 h-10 text-sm bg-background border-border"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onApply} className="h-10 text-sm">
            Apply Period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
