"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ReportOmittedBannerProps {
  count: number;
  itemName?: string; // e.g. "months", "vouchers"
  onRestoreLast: () => void;
  onRestoreAll: () => void;
}

export function ReportOmittedBanner({
  count,
  itemName = "records",
  onRestoreLast,
  onRestoreAll,
}: ReportOmittedBannerProps) {
  if (count === 0) return null;
  return (
    <div className="mt-4 p-3 bg-secondary border border-border rounded-md text-xs text-muted-foreground flex justify-between items-center no-print">
      <span>
        You have hidden <strong>{count}</strong> {itemName} from the report.
      </span>
      <div className="flex gap-2">
        <Button variant="outline" className="h-9 px-3" onClick={onRestoreLast}>
          Restore Last
        </Button>
        <Button
          variant="outline"
          className="h-9 px-3 text-destructive border-destructive/25 hover:bg-destructive/10"
          onClick={onRestoreAll}
        >
          Restore All
        </Button>
      </div>
    </div>
  );
}
