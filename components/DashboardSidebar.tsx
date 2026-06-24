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
    <aside className="flex h-full w-64 flex-col rounded-lg border border-border bg-card text-card-foreground shrink-0 select-none shadow-sm">
      {/* Brand Header */}
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground font-black text-xs shadow-sm shrink-0">
          T
        </div>
        <span className="text-xs font-black tracking-widest text-foreground uppercase">
          Texora
        </span>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 font-sans text-xs">
        {/* Dashboard Link always visible */}
        <div className="space-y-1">
          <Link
            href={dashboardHref}
            className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 font-medium transition-all duration-150 ${
              dashboardActive
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            <Icons.LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Dashboard Overview</span>
          </Link>
        </div>

        {/* Gateway Menu Panels */}
        {sortedGroupNames.map((groupName) => (
          <div key={groupName} className="space-y-1">
            <span className="block px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              {groupName}
            </span>
            <div className="space-y-0.5">
              {groups[groupName].map((item) => {
                const isActive = pathname.startsWith(item.pageUrl || "");
                return (
                  <Link
                    key={item.accessItem}
                    href={item.pageUrl || "/dashboard"}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
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
      <div className="border-t border-border py-2 px-3 flex items-center justify-between gap-3 bg-muted/5">
        <Link
          href="/dashboard/my-profile"
          className="flex items-center gap-2 overflow-hidden text-xs hover:opacity-80 transition-opacity flex-1 min-w-0"
        >
          <span className="truncate font-semibold text-foreground">{userName}</span>
          <span className="rounded bg-primary/10 px-1 py-0 text-xs font-semibold uppercase tracking-wider text-primary shrink-0 scale-90 origin-left">
            {role}
          </span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign Out"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 active:scale-[0.95] transition-all duration-150 cursor-pointer shrink-0"
        >
          <Icons.LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
