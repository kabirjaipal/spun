"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";
import { UserPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// 1. Sidebar Context and Provider for global responsive & collapse state
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load and apply persistent collapsed state on desktop
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const handleSetCollapsed = (val: boolean) => {
    setIsCollapsed(val);
    localStorage.setItem("sidebar-collapsed", String(val));
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed: handleSetCollapsed,
        isMobileOpen,
        setIsMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

// 2. Dashboard Sidebar Component Props
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
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();

  // Helper for rendering icons dynamically
  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className="h-4 w-4 shrink-0" />;
  };

  // Group permissions by pageGroup
  const groups = permissions
    .filter((p) => 
      p.accessItem !== "ledger_groups" && 
      p.accessItem !== "ledgers" && 
      p.accessItem !== "jobs" && 
      p.accessItem !== "mills" &&
      p.accessItem !== "inventory_categories" &&
      p.accessItem !== "inventory_groups" &&
      p.accessItem !== "units_of_measurement"
    )
    .reduce((acc, curr) => {
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

  // Render Sidebar content either for desktop (respects isCollapsed) or mobile (always expanded)
  const renderSidebarContent = (isMobile: boolean) => {
    const collapsed = isMobile ? false : isCollapsed;
    const clickHandler = isMobile ? () => setIsMobileOpen(false) : undefined;

    return (
      <div className="flex h-full w-full flex-col">
        {/* Brand Header */}
        <div className={cn(
          "flex h-12 items-center border-b border-border px-4 justify-between shrink-0",
          collapsed && "px-0 justify-center"
        )}>
          {collapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-all"
              title="Expand Sidebar"
            >
              <Icons.ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground font-black text-xs shadow-sm shrink-0">
                  T
                </div>
                <span className="text-xs font-black tracking-widest text-foreground uppercase">
                  Texora
                </span>
              </div>
              {isMobile ? (
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-all"
                  title="Close Sidebar"
                >
                  <Icons.X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setIsCollapsed(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-all"
                  title="Collapse Sidebar"
                >
                  <Icons.ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation Menu */}
        <div className={cn(
          "flex-1 overflow-y-auto py-2.5 space-y-3 font-sans text-xs",
          collapsed ? "px-2" : "px-3"
        )}>
          {/* Dashboard Link always visible */}
          <div className="space-y-1">
            <Link
              href={dashboardHref}
              onClick={clickHandler}
              title={collapsed ? "Dashboard Overview" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md py-1.5 font-medium transition-all duration-150",
                collapsed ? "justify-center px-0" : "px-3",
                dashboardActive
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icons.LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Dashboard Overview</span>}
            </Link>
          </div>

          {/* Gateway Menu Panels */}
          {sortedGroupNames.map((groupName) => (
            <div key={groupName} className="space-y-1">
              {!collapsed ? (
                <span className="block px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
                  {groupName}
                </span>
              ) : (
                <div className="h-px bg-border my-2 mx-1" />
              )}
              <div className="space-y-0.5">
                {groups[groupName].map((item) => {
                  const isActive = item.pageUrl
                    ? pathname === item.pageUrl || pathname.startsWith(item.pageUrl + "/")
                    : false;
                  return (
                    <Link
                      key={item.accessItem}
                      href={item.pageUrl || "/dashboard"}
                      onClick={clickHandler}
                      title={collapsed ? item.pageTitle : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md py-1.5 font-medium transition-all duration-150",
                        collapsed ? "justify-center px-0" : "px-3",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      {renderIcon(item.pageIcon || "File")}
                      {!collapsed && <span>{item.pageTitle}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer / User Profile & SignOut */}
        <div className={cn(
          "border-t border-border py-2 flex items-center justify-between gap-3 bg-muted/5 shrink-0",
          collapsed ? "flex-col px-2 py-3" : "px-3"
        )}>
          {collapsed ? (
            <>
              <Link
                href="/dashboard/my-profile"
                onClick={clickHandler}
                title="My Profile"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase hover:opacity-80 transition-opacity"
              >
                {userName ? userName[0] : "U"}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign Out"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 active:scale-[0.95] transition-all duration-150 cursor-pointer shrink-0"
              >
                <Icons.LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/dashboard/my-profile"
                onClick={clickHandler}
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
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile, visible from medium screens and up */}
      <aside className={cn(
        "hidden md:flex h-full flex-col rounded-lg border border-border bg-card text-card-foreground shrink-0 select-none shadow-sm transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Sidebar (Radix Sheet Drawer) - visible on mobile screens */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-border h-full flex flex-col bg-card" showCloseButton={false}>
          {renderSidebarContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}

