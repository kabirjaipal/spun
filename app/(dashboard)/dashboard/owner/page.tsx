import React from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { mCompanies, mInventory, tAuditLogs, mUsers } from "@/lib/db/schema";
import { eq, sql, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";

export default async function OwnerDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  // Only owners without a company land here
  if (session.user.role !== "owner") redirect("/dashboard");

  const [companiesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mCompanies)
    .where(isNull(mCompanies.deletedOn));

  const [usersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mUsers)
    .where(eq(mUsers.isActive, true));

  const [totalInventoryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mInventory)
    .where(isNull(mInventory.deletedOn));

  const [auditLogsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tAuditLogs);

  const recentLogs = await db.query.tAuditLogs.findMany({
    orderBy: (logs, { desc }) => [desc(logs.createdOn)],
    limit: 5,
  });

  const stats = [
    { name: "COMPANIES", value: Number(companiesCount?.count || 0), icon: "Building2", color: "text-primary bg-primary/10", description: "Registered textile companies" },
    { name: "ACTIVE USERS", value: Number(usersCount?.count || 0), icon: "Users", color: "text-success bg-success/10", description: "Platform active user accounts" },
    { name: "SYSTEM INVENTORY", value: Number(totalInventoryCount?.count || 0), icon: "Package", color: "text-warning bg-warning/10", description: "Registered inventory items" },
    { name: "AUDIT LOGS", value: Number(auditLogsCount?.count || 0), icon: "History", color: "text-info bg-info/10", description: "Recorded administrative events" },
  ];

  const renderIcon = (iconName: string, className: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent className={className} size={22} />;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground">
          WELCOME BACK, {session.user.name?.toUpperCase()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide administration and overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/75">{stat.name}</span>
                <span className="mt-1 block text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
              <div className={`rounded-lg p-2.5 ${stat.color}`}>{renderIcon(stat.icon, "h-5 w-5")}</div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground truncate">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">ADMINISTRATIVE ACTIONS</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/dashboard/users" className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="p-2 rounded bg-primary/10 text-primary group-hover:scale-105 transition-transform"><Icons.UserCheck size={18} /></div>
              <div>
                <span className="text-sm font-semibold text-foreground">Manage Users</span>
                <span className="block text-xs text-muted-foreground">View and configure system users</span>
              </div>
            </Link>
            <Link href="/dashboard/roles" className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-warning hover:bg-warning/5 transition-all group">
              <div className="p-2 rounded bg-warning/10 text-warning group-hover:scale-105 transition-transform"><Icons.ShieldAlert size={18} /></div>
              <div>
                <span className="text-sm font-semibold text-foreground">Roles & Access</span>
                <span className="block text-xs text-muted-foreground">Set user roles and permissions</span>
              </div>
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">RECENT AUDIT LOGS</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border bg-card text-xs text-left">
                <thead className="bg-muted/40 font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Table</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Record ID</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {recentLogs.length > 0 ? (
                    recentLogs.map((log) => (
                      <tr key={log.auditLogId} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{log.tableName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.actionType === "create" ? "bg-success/15 text-success" :
                            log.actionType === "update" ? "bg-info/15 text-info" : "bg-danger/15 text-danger"
                          }`}>
                            {log.actionType.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{log.recordId.toString()}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{new Date(log.createdOn).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No audit events recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">SYSTEM CONFIGURATION</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Database Engine</span>
                <span className="font-bold text-primary">PostgreSQL</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">ORM Tooling</span>
                <span className="font-bold text-primary">Drizzle ORM</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Authentication</span>
                <span className="font-bold text-primary">NextAuth v5</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Deployment Runtime</span>
                <span className="font-bold text-primary">Next.js Node</span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-xs text-muted-foreground leading-normal">
            You are signed in as a platform-wide system owner. You have full access to view, update, or manage system configuration, user role maps, and audit trails.
          </div>
        </div>
      </div>
    </div>
  );
}
