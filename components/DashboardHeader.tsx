"use client";

import React, { useState } from "react";
import { Menu, Building2 } from "lucide-react";
import { useSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DashboardHeaderProps {
  companyName: string;
  financialYearStart: string | null;
  userCompanies?: { companyId: number; companyName: string }[];
  currentCompanyId?: number | null;
}

export default function DashboardHeader({
  companyName,
  financialYearStart,
  userCompanies = [],
  currentCompanyId = null,
}: DashboardHeaderProps) {
  const { setIsMobileOpen } = useSidebar();
  const { update } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const handleCompanySwitch = async (newCompanyIdStr: string) => {
    const newCompanyId = Number(newCompanyIdStr);
    if (newCompanyId === currentCompanyId || switching) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/users/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: newCompanyId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to switch company");
      }

      // Update next-auth session and fully reload page to fetch new company context
      await update();
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "An error occurred while switching company.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between rounded-lg border border-border bg-card px-4 md:px-6 shadow-sm">
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
        
        {userCompanies.length > 1 ? (
          <div className="flex items-center gap-2">
            <Select
              disabled={switching}
              value={currentCompanyId ? String(currentCompanyId) : undefined}
              onValueChange={handleCompanySwitch}
            >
              <SelectTrigger className="h-9 border border-input px-3 text-sm font-semibold uppercase tracking-wider text-foreground">
                <SelectValue placeholder="Select Company" />
              </SelectTrigger>
              <SelectContent>
                {userCompanies.map((c) => (
                  <SelectItem key={c.companyId} value={String(c.companyId)}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {switching && <span className="text-xs text-muted-foreground animate-pulse font-medium">Switching...</span>}
          </div>
        ) : (
          <h1 className="text-sm font-bold text-foreground uppercase tracking-wider truncate max-w-[200px] sm:max-w-none">
            {companyName}
          </h1>
        )}
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
