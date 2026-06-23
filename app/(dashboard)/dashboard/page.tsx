import React from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { mCustomers, mSuppliers, mProducts, mCompanies, mLedgers } from "@/lib/db/schema";
import { eq, sql, isNull, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");

  // Owners without a company go to the admin dashboard
  if (session.user.role === "owner" && !session.user.companyId) {
    redirect("/dashboard/owner");
  }

  if (!session.user.companyId) redirect("/setup-company");

  const companyIdVal = Number(session.user.companyId);

  // Fetch Company Info
  const company = await db.query.mCompanies.findFirst({
    where: eq(mCompanies.companyId, companyIdVal),
  });

  if (!company) {
    redirect("/setup-company");
  }

  // Query Statistics (respecting company tenant and soft deletes)
  const [customersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mCustomers)
    .where(
      and(eq(mCustomers.companyId, companyIdVal), isNull(mCustomers.deletedOn))
    );

  const [suppliersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mSuppliers)
    .where(
      and(eq(mSuppliers.companyId, companyIdVal), isNull(mSuppliers.deletedOn))
    );

  const [productsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mProducts)
    .where(
      and(eq(mProducts.companyId, companyIdVal), isNull(mProducts.deletedOn))
    );

  const [ledgersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mLedgers)
    .where(
      and(eq(mLedgers.companyId, companyIdVal), isNull(mLedgers.deletedOn))
    );

  const stats = [
    {
      name: "CUSTOMERS",
      value: Number(customersCount?.count || 0),
      icon: "Users",
      color: "text-primary bg-primary/10",
      description: "Active business customers",
    },
    {
      name: "SUPPLIERS",
      value: Number(suppliersCount?.count || 0),
      icon: "Truck",
      color: "text-success bg-success/10",
      description: "Fabric and yarn suppliers",
    },
    {
      name: "PRODUCTS",
      value: Number(productsCount?.count || 0),
      icon: "Package",
      color: "text-warning bg-warning/10",
      description: "Inventory stock items",
    },
    {
      name: "LEDGERS",
      value: Number(ledgersCount?.count || 0),
      icon: "BookOpen",
      color: "text-info bg-info/10",
      description: "Chart of Accounts ledgers",
    },
  ];

  // Helper for rendering icons dynamically
  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className={className} size={22} />;
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground">
          WELCOME BACK, {session.user.name?.toUpperCase()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Managing bookkeeping and inventory for{" "}
          <span className="font-semibold text-foreground">
            {company.companyName}
          </span>
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/50 pt-4 sm:grid-cols-3 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">GSTIN</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block">
              {company.gstNo || "Not Configured"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">PAN</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block">
              {company.panNo || "Not Configured"}
            </span>
          </div>
          <div>
            <span className="font-semibold text-muted-foreground/80 block uppercase">ADDRESS</span>
            <span className="text-foreground font-medium text-sm mt-0.5 block truncate">
              {company.address || "Not Configured"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">
                  {stat.name}
                </span>
                <span className="mt-1 block text-2xl font-bold text-foreground">
                  {stat.value}
                </span>
              </div>
              <div className={`rounded-lg p-2.5 ${stat.color}`}>
                {renderIcon(stat.icon, "h-5 w-5")}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground truncate">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Info about other phases */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">
            QUICK ACTIONS & NAVIGATION
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/dashboard/customers"
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="p-2 rounded bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Icons.UserPlus size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Create Customer
                </span>
                <span className="block text-[10px] text-muted-foreground">Add new buyer ledger</span>
              </div>
            </Link>

            <Link
              href="/dashboard/products"
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-warning hover:bg-warning/5 transition-all group"
            >
              <div className="p-2 rounded bg-warning/10 text-warning group-hover:scale-105 transition-transform">
                <Icons.PlusSquare size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Add Stock Item
                </span>
                <span className="block text-[10px] text-muted-foreground">Register new fabric product</span>
              </div>
            </Link>

            <Link
              href="/dashboard/sales"
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-success hover:bg-success/5 transition-all group"
            >
              <div className="p-2 rounded bg-success/10 text-success group-hover:scale-105 transition-transform">
                <Icons.Receipt size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Sales Voucher
                </span>
                <span className="block text-[10px] text-muted-foreground">Record a new fabric sale</span>
              </div>
            </Link>

            <Link
              href="/dashboard/ledger-report"
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-info hover:bg-info/5 transition-all group"
            >
              <div className="p-2 rounded bg-info/10 text-info group-hover:scale-105 transition-transform">
                <Icons.FileText size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  Ledger Report
                </span>
                <span className="block text-[10px] text-muted-foreground">View statement of accounts</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">
              ERP CONFIGURATION STATUS
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Phase 1: Auth & Company</span>
                <span className="font-bold text-success">COMPLETED</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Phase 2: Masters (Ledgers)</span>
                <span className="font-semibold text-muted-foreground/60">PENDING RUN</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Phase 3: Voucher Engine</span>
                <span className="font-semibold text-muted-foreground/60">PENDING RUN</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Phase 4-5: Inventory & Reports</span>
                <span className="font-semibold text-muted-foreground/60">PENDING RUN</span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-[10px] text-muted-foreground leading-normal">
            Texora maps accounts and inventory using Tally's fundamental voucher standards, modernizing form design and access speeds.
          </div>
        </div>
      </div>
    </div>
  );
}
