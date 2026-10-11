"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  Receipt,
  RotateCcw,
  Truck,
} from "lucide-react";

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<"vouchers" | "textile">("vouchers");

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden transition-all">
      {/* ERP Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-3 gap-1.5">
            <span className="h-3 w-3 rounded-full bg-danger/80" />
            <span className="h-3 w-3 rounded-full bg-warning/80" />
            <span className="h-3 w-3 rounded-full bg-success/80" />
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span>Spun Trading Co.</span>
            <span className="text-muted-foreground font-normal">· Surat, GJ</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <Badge variant="outline" className="text-xs bg-background">
            FY 2026-27
          </Badge>
          <div className="flex rounded-lg border border-border bg-background p-0.5">
            <Button
              variant={activeTab === "vouchers" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("vouchers")}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Voucher Desk
            </Button>
            <Button
              variant={activeTab === "textile" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("textile")}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Mill & Job Work
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-6 border-b border-border bg-card">
        <div className="rounded-xl border border-border p-3 sm:p-4 bg-muted/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <span>Receivables</span>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold text-foreground">₹ 14,82,500</p>
          <p className="mt-1 text-xs text-success font-medium">18 active buyers</p>
        </div>

        <div className="rounded-xl border border-border p-3 sm:p-4 bg-muted/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <span>Payables</span>
            <ArrowDownLeft className="h-4 w-4 text-danger" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold text-foreground">₹ 8,45,200</p>
          <p className="mt-1 text-xs text-muted-foreground">Due across 12 mills</p>
        </div>

        <div className="rounded-xl border border-border p-3 sm:p-4 bg-muted/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <span>Mill Job Work</span>
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold text-foreground">32,400 MTR</p>
          <p className="mt-1 text-xs text-primary font-medium">4 dye houses active</p>
        </div>

        <div className="rounded-xl border border-border p-3 sm:p-4 bg-muted/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <span>Gray Stock</span>
            <Layers className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold text-foreground">18,250 MTR</p>
          <p className="mt-1 text-xs text-muted-foreground">Ready for job outward</p>
        </div>
      </div>

      {/* Dynamic Tab Content */}
      <div className="p-4 sm:p-6 bg-background/50">
        {activeTab === "vouchers" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Live Double-Entry Vouchers (Audit Balanced)
              </h3>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Auto Reversal Enabled
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Voucher No</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Party / Account</th>
                    <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">SINV-2026-089</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">Sales</span>
                    </td>
                    <td className="py-2.5 px-3">Ambika Fabrics (Surat)</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">3,45,000.00</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">-</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Balanced
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">PUR-2026-114</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground text-xs">Purchase</span>
                    </td>
                    <td className="py-2.5 px-3">Radhey Spinning Mills</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">-</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">2,80,000.00</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Balanced
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">REC-2026-056</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-success text-xs">Receipt</span>
                    </td>
                    <td className="py-2.5 px-3">HDFC Bank · Kothari Silks</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">1,50,000.00</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">-</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Settled
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">JRN-2026-021</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">Journal</span>
                    </td>
                    <td className="py-2.5 px-3">Freight & Brokerage Haste</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">18,400.00</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">18,400.00</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Reconciled
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Active Mill Dyeing & Job Work Movement
              </h3>
              <Badge variant="outline" className="text-xs text-primary border-primary/30">
                Lot Traceability Active
              </Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Lot No</th>
                    <th className="py-2.5 px-3">Process</th>
                    <th className="py-2.5 px-3">Processor / Mill</th>
                    <th className="py-2.5 px-3">Quality / Item</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">LOT-8841</td>
                    <td className="py-2.5 px-3">Mill Outward (Dyeing)</td>
                    <td className="py-2.5 px-3">Shree Krishna Processors</td>
                    <td className="py-2.5 px-3">Cotton Satin 60x60</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">12,500 MTR</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-warning text-xs font-semibold">
                        <Clock className="h-3 w-3" /> Processing
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">LOT-8835</td>
                    <td className="py-2.5 px-3">Job Inward (Finished)</td>
                    <td className="py-2.5 px-3">Vardhman Dyeing Mills</td>
                    <td className="py-2.5 px-3">Rayon Twill 140 GSM</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">9,800 MTR</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Received
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-primary font-semibold">LOT-8829</td>
                    <td className="py-2.5 px-3">Lot Transfer</td>
                    <td className="py-2.5 px-3">Internal Warehouse #2</td>
                    <td className="py-2.5 px-3">Polyester Viscose Blend</td>
                    <td className="py-2.5 px-3 text-right font-mono text-foreground">10,100 MTR</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <RotateCcw className="h-3 w-3" /> Transferred
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
