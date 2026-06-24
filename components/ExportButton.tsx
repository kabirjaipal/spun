"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/export-csv";

interface ExportButtonProps {
  filename: string;
  headers: string[];
  keys: string[];
  rows: any[];
  canExport?: boolean;
}

export default function ExportButton({
  filename,
  headers,
  keys,
  rows,
  canExport = true,
}: ExportButtonProps) {
  if (!canExport) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportToCsv(filename, headers, keys, rows)}
      className="flex items-center gap-1.5 h-8 text-xs bg-card hover:bg-accent border-border"
    >
      <Download className="h-3.5 w-3.5" />
      <span>Export CSV</span>
    </Button>
  );
}
