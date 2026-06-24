import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserPagePermissions } from "@/lib/permissions";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Building2 } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If no session, redirect to login (middleware should catch this, but safe fallback)
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch company details
  let companyName = "No Company";
  let financialYearStart: string | null = null;
  if (session.user.companyId) {
    const company = await db.query.mCompanies.findFirst({
      where: eq(mCompanies.companyId, Number(session.user.companyId)),
    });
    if (company) {
      companyName = company.companyName;
      if (company.financialYearStart) {
        try {
          const dateVal = typeof company.financialYearStart === "string"
            ? new Date(company.financialYearStart + "T00:00:00") // append T00:00:00 to prevent timezone drift
            : company.financialYearStart;
          if (!isNaN(dateVal.getTime())) {
            financialYearStart = dateVal.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit"
            }).toUpperCase();
          }
        } catch (e) {
          // No fallback
        }
      }
    }
  }

  // Fetch page permissions
  const permissions = await getUserPagePermissions(session.user.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background p-3 gap-3 font-sans">
      {/* Dynamic Sidebar - spans full height on the left */}
      <DashboardSidebar
        companyName={companyName}
        userName={session.user.name || "User"}
        userEmail={session.user.email || ""}
        role={session.user.role || "viewer"}
        hasCompany={!!session.user.companyId}
        permissions={permissions}
      />

      {/* Right Container: Header & Content stack vertically */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between rounded-lg border border-border bg-card px-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-bold text-foreground uppercase tracking-wider">
              {companyName}
            </h1>
          </div>
          {financialYearStart && (
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              FINANCIAL YEAR START: <span className="text-foreground">{financialYearStart}</span>
            </div>
          )}
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
