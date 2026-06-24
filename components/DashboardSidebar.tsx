"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";
import { UserPermission } from "@/lib/permissions";

interface DashboardSidebarProps {
  companyName: string;
  userName: string;
  userEmail: string;
  role: string;
  hasCompany: boolean;
  permissions: UserPermission[];
}

export default function DashboardSidebar({
  companyName,
  userName,
  userEmail,
  role,
  hasCompany,
  permissions,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  // Determine current page from permissions so the header shows the configured page title
  const currentPage = permissions.find((p) => (p.pageUrl || "") && pathname.startsWith(p.pageUrl));
  const headerTitle = currentPage ? currentPage.pageTitle : pathname;
  const headerIcon = currentPage ? currentPage.pageIcon : "LayoutDashboard";

  // Helper for rendering icons dynamically
  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className="h-4 w-4 shrink-0" />;
  };

  // Group permissions by pageGroup
  const groups = permissions.reduce((acc, curr) => {
    const groupName = curr.pageGroup || "Other";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(curr);
    return acc;
  }, {} as Record<string, UserPermission[]>);

  // Group order: Masters, Transactions, Inventory, Reports, Administration
  const groupOrder = ["Masters", "Transactions", "Inventory", "Reports", "Administration"];
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    const indexA = groupOrder.indexOf(a);
    const indexB = groupOrder.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Dashboard home link differs by role
  const dashboardHref = role === "owner" && !hasCompany ? "/dashboard/owner" : "/dashboard";
  const dashboardActive = pathname === dashboardHref;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card text-card-foreground shrink-0 select-none">
      {/* Gateway Header */}
      <div className="flex h-16 flex-col justify-center border-b border-border px-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary font-bold text-xs text-primary-foreground shadow-sm">
            {renderIcon(headerIcon)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-bold text-foreground uppercase tracking-widest leading-none">
              {headerTitle}
            </span>
            <span className="truncate text-xs text-muted-foreground mt-0.5 font-medium font-sans">
              {companyName.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 font-sans text-xs">
        {/* Dashboard Link always visible */}
        <div className="px-1">
          <Link
            href={dashboardHref}
            className={`flex items-center gap-3 rounded px-2.5 py-1.5 font-semibold tracking-wide transition-all duration-200 hover:translate-x-0.5 ${
              dashboardActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icons.LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Dashboard Overview</span>
          </Link>
        </div>


        {/* Gateway Menu Panels */}
        {sortedGroupNames.map((groupName) => (
          <div key={groupName} className="space-y-0.5 border border-border/50 rounded-lg p-1 bg-muted/5">
            <span className="block px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border/20 mb-1">
              {groupName}
            </span>
            <div className="space-y-0.5">
              {groups[groupName].map((item) => {
                const isActive = pathname.startsWith(item.pageUrl || "");
                return (
                  <Link
                    key={item.accessItem}
                    href={item.pageUrl || "/dashboard"}
                    className={`flex items-center gap-2.5 rounded px-2 py-1.5 font-semibold transition-all duration-200 hover:translate-x-0.5 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {renderIcon(item.pageIcon || "File")}
                    <span>{item.pageTitle}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer / User Profile & SignOut */}
      <div className="border-t border-border p-3 flex flex-col gap-2.5 bg-muted/15">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden text-xs">
            <span className="truncate font-bold text-foreground leading-tight">{userName}</span>
            <span className="truncate text-muted-foreground leading-none mt-0.5">{userEmail}</span>
            <span className="mt-1 truncate text-xs uppercase text-primary font-extrabold tracking-wider">
              {role}
            </span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center gap-2 rounded border border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent hover:shadow-sm active:scale-[0.98] transition-all duration-200"
        >
          <Icons.LogOut className="h-3.5 w-3.5" />
          <span>SIGN OUT</span>
        </button>
      </div>
    </aside>
  );
}
