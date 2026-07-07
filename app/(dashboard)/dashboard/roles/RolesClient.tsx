"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, Check, X } from "lucide-react";
import { UserPermission } from "@/lib/permissions";

export default function RolesClient({
  ownerPermissions,
  companyPermissions,
}: {
  ownerPermissions: UserPermission[];
  companyPermissions: UserPermission[];
}) {
  const allModules = Array.from(
    new Set([
      ...ownerPermissions.map((p) => p.pageTitle),
      ...companyPermissions.map((p) => p.pageTitle),
    ])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Access Control</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Role Panel */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <div className="rounded p-2 bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Company Role</h2>
              <p className="text-xs text-muted-foreground">Standard access for accounting staff, sales, and inventory managers.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-border/50">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Module</th>
                  <th className="px-3 py-2.5 text-center">Read</th>
                  <th className="px-3 py-2.5 text-center">Create</th>
                  <th className="px-3 py-2.5 text-center">Update</th>
                  <th className="px-3 py-2.5 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {companyPermissions.map((p) => (
                  <tr key={p.accessItem} className="hover:bg-muted/10">
                    <td className="px-3 py-2.5 font-medium">{p.pageTitle}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.r ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.c ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.u ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.d ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Owner Role Panel */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <div className="rounded p-2 bg-warning/10 text-warning">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Owner Role</h2>
              <p className="text-xs text-muted-foreground">Full root credentials over administrative controls and settings.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-border/50">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Module</th>
                  <th className="px-3 py-2.5 text-center">Read</th>
                  <th className="px-3 py-2.5 text-center">Create</th>
                  <th className="px-3 py-2.5 text-center">Update</th>
                  <th className="px-3 py-2.5 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {ownerPermissions.map((p) => (
                  <tr key={p.accessItem} className="hover:bg-muted/10">
                    <td className="px-3 py-2.5 font-medium">{p.pageTitle}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.r ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.c ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.u ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">{p.d ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-danger" />}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
