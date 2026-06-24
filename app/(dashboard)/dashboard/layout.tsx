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
  if (session.user.companyId) {
    const company = await db.query.mCompanies.findFirst({
      where: eq(mCompanies.companyId, Number(session.user.companyId)),
    });
    if (company) {
      companyName = company.companyName;
    }
  }

  // Fetch page permissions
  const permissions = await getUserPagePermissions(session.user.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-muted/30 font-sans">
      {/* Dynamic Sidebar */}
      <DashboardSidebar
        companyName={companyName}
        userName={session.user.name || "User"}
        userEmail={session.user.email || ""}
        role={session.user.role || "viewer"}
        hasCompany={!!session.user.companyId}
        permissions={permissions}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-bold text-foreground uppercase tracking-wider">
              {companyName}
            </h1>
          </div>
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            FINANCIAL YEAR START: <span className="text-foreground">APR 01</span>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
