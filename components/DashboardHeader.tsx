"use client";

import React from "react";
import { Menu, Building2 } from "lucide-react";
import { useSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  companyName: string;
  financialYearStart: string | null;
}

export default function DashboardHeader({
  companyName,
  financialYearStart,
}: DashboardHeaderProps) {
  const { setIsMobileOpen } = useSidebar();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between rounded-lg border border-border bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open Sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Building2 className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-bold text-foreground uppercase tracking-wider truncate max-w-[200px] sm:max-w-none">
          {companyName}
        </h1>
      </div>
      {financialYearStart && (
        <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          <span className="hidden sm:inline">FINANCIAL YEAR START: </span>
          <span className="text-foreground">{financialYearStart}</span>
        </div>
      )}
    </header>
  );
}
