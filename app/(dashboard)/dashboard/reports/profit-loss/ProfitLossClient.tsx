"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
}
interface LedgerGroup {
  groupId: number;
  groupName: string;
  parentGroupId: number | null;
}
interface LedgerBalance {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  debit: number;
  credit: number;
}
interface ProfitLossClientProps {
  company: Company;
  groups: LedgerGroup[];
  ledgers: LedgerBalance[];
  openingStock: number;
  closingStock: number;
  canExport: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

// Static group row + ledger rows — Tally style
function GroupSection({
  title,
  items,
  total,
  detailed,
  indented = false,
}: {
  title: string;
  items: { name: string; amount: number; ledgerId?: number }[];
  total: number;
  detailed: boolean;
  indented?: boolean;
}) {
  if (total === 0 && items.length === 0) return null;

  return (
    <div className="group/row">
      {/* Main Group Row */}
      <div className="flex items-center justify-between py-2 px-3">
        <div className="flex-1 flex items-center gap-2">
          <span className={`font-bold text-foreground ${indented ? "pl-6" : ""}`}>
            {title}
          </span>
        </div>
        <div className="flex">
          <div className="w-36"></div>
          <div className="w-36 text-right font-mono font-bold text-foreground">
            {total !== 0 ? fmt(total) : "—"}
          </div>
        </div>
      </div>

      {/* Sub-Ledgers (Detailed View) */}
      {detailed && items.length > 0 && (
        <div className="pb-2">
          {items.map((l, idx) => (
            l.amount !== 0 ? (
              <div
                key={l.name}
                className="flex items-center justify-between py-1 px-3 pl-8 hover:bg-muted/10 group/ledg"
              >
                <div className="flex-1 flex items-center gap-2">
                  {l.ledgerId ? (
                    <a
                      href={`/dashboard/reports/ledger-report?ledgerId=${l.ledgerId}`}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {l.name}
                    </a>
                  ) : (
                    <span className="text-xs italic text-foreground/80">{l.name}</span>
                  )}
                </div>
                <div className="flex">
                  <div className={`w-36 text-right pr-4 font-mono text-xs text-foreground/90 ${
                    idx === items.length - 1 ? "border-b border-border pb-0.5" : ""
                  }`}>
                    {fmt(l.amount)}
                  </div>
                  <div className="w-36"></div>
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}

function AccountWithReturnSection({
  title,
  mainItems,
  returnItems,
  grossTotal,
  returnTotal,
  netTotal,
  detailed,
}: {
  title: string;
  mainItems: { name: string; amount: number; ledgerId?: number }[];
  returnItems: { name: string; amount: number; ledgerId?: number }[];
  grossTotal: number;
  returnTotal: number;
  netTotal: number;
  detailed: boolean;
}) {
  if (grossTotal === 0 && returnTotal === 0 && mainItems.length === 0 && returnItems.length === 0) return null;

  return (
    <div className="group/row">
      {/* Main Group Header Row */}
      <div className="flex items-center justify-between py-2 px-3">
        <div className="flex-1">
          <span className="font-bold text-foreground">{title}</span>
        </div>
        <div className="flex">
          <div className="w-36"></div>
          <div className="w-36 text-right font-mono font-bold text-foreground">
            {fmt(netTotal)}
          </div>
        </div>
      </div>

      {/* Details list */}
      {detailed && (
        <div className="pb-2">
          {/* Main items */}
          {mainItems.map((item) => (
            item.amount !== 0 ? (
              <div key={item.name} className="flex items-center justify-between py-1 px-3 pl-8 hover:bg-muted/10">
                <div className="flex-1">
                  {item.ledgerId ? (
                    <a
                      href={`/dashboard/reports/ledger-report?ledgerId=${item.ledgerId}`}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className="text-xs text-foreground/80">{item.name}</span>
                  )}
                </div>
                <div className="flex">
                  <div className="w-36 text-right pr-4 font-mono text-xs text-foreground/90">
                    {fmt(item.amount)}
                  </div>
                  <div className="w-36"></div>
                </div>
              </div>
            ) : null
          ))}

          {/* Return items */}
          {returnItems.map((item, idx) => (
            item.amount !== 0 ? (
              <div key={item.name} className="flex items-center justify-between py-1 px-3 pl-8 hover:bg-muted/10">
                <div className="flex-1">
                  {item.ledgerId ? (
                    <a
                      href={`/dashboard/reports/ledger-report?ledgerId=${item.ledgerId}`}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Less: {item.name}
                    </a>
                  ) : (
                    <span className="text-xs text-foreground/80">Less: {item.name}</span>
                  )}
                </div>
                <div className="flex">
                  <div className={`w-36 text-right pr-4 font-mono text-xs text-foreground/90 ${
                    idx === returnItems.length - 1 ? "border-b border-border pb-0.5" : ""
                  }`}>
                    {fmt(item.amount)}
                  </div>
                  <div className="w-36"></div>
                </div>
              </div>
            ) : null
          ))}

          {/* Show calculation footer when returns exist */}
          {returnTotal !== 0 && (
            <div className="flex items-center justify-between py-1 px-3 pl-8 text-xs font-semibold text-muted-foreground">
              <div className="flex-1 pl-4">Net {title}</div>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono border-t border-border pt-0.5 pr-2">
                  {fmt(netTotal)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NetResultRow({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: "profit" | "loss";
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3">
      <div className="flex-1 font-bold">
        <span className={color === "profit" ? "text-success" : "text-danger"}>
          {label}
        </span>
      </div>
      <div className="flex">
        <div className="w-36"></div>
        <div className="w-36 text-right font-mono font-bold">
          <span className={color === "profit" ? "text-success" : "text-danger"}>
            {fmt(amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProfitLossContent({
  company,
  groups,
  ledgers,
  openingStock,
  closingStock,
  canExport,
}: ProfitLossClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fyStartYear = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return m >= 3 ? y : y - 1;
  })();
  const fromParam =
    searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam =
    searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [detailed, setDetailed] = useState(true);

  const handleApply = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // ── resolve top-level ancestor group names ──────────────────────────────────
  const getGroupNames = (gId: number | null): string[] => {
    if (!gId) return [];
    const names: string[] = [];
    let cur = gId;
    for (let i = 0; i < 10; i++) {
      const g = groups.find((x) => x.groupId === cur);
      if (!g) break;
      names.push(g.groupName.toLowerCase());
      if (!g.parentGroupId) break;
      cur = g.parentGroupId;
    }
    return names;
  };

  // ── classify ledgers into correct trading / profit loss buckets ────────────
  const salesItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const salesReturnItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const purchaseItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const purchaseReturnItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const directExpItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const directIncItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const indirectExpItems: { name: string; amount: number; ledgerId?: number }[] = [];
  const indirectIncItems: { name: string; amount: number; ledgerId?: number }[] = [];

  for (const l of ledgers) {
    const name = l.ledgerName.toLowerCase();
    const type = l.ledgerType.toLowerCase();
    const gNames = getGroupNames(l.groupId);
    const hasGroup = (str: string) => gNames.some((gn) => gn.includes(str));

    // Determine category
    let cat: "sales" | "sales_return" | "purchase" | "purchase_return" | "direct_expense" | "direct_income" | "indirect_expense" | "indirect_income" | null = null;

    if (type === "sales_return" || name.includes("sales return") || name.includes("sales_return") || hasGroup("sales return") || hasGroup("sales_return")) {
      cat = "sales_return";
    } else if (type === "purchase_return" || name.includes("purchase return") || name.includes("purchase_return") || hasGroup("purchase return") || hasGroup("purchase_return")) {
      cat = "purchase_return";
    } else if (type === "sales" || name.includes("sales account") || hasGroup("sales account") || gNames.some((gn) => gn === "sales")) {
      cat = "sales";
    } else if (type === "purchase" || name.includes("purchase account") || hasGroup("purchase account") || gNames.some((gn) => gn === "purchase")) {
      cat = "purchase";
    } else if (gNames.some((gn) => gn.includes("direct expense")) || (type === "expense" && (hasGroup("direct") || hasGroup("trading") || hasGroup("manufacturing")))) {
      cat = "direct_expense";
    } else if (gNames.some((gn) => gn.includes("indirect expense")) || type === "expense" || type === "general") {
      cat = "indirect_expense";
    } else if (gNames.some((gn) => gn.includes("direct income")) || (type === "income" && (hasGroup("direct") || hasGroup("trading") || hasGroup("revenue")))) {
      cat = "direct_income";
    } else if (gNames.some((gn) => gn.includes("indirect income")) || type === "income") {
      cat = "indirect_income";
    }

    if (!cat) continue;

    // Aggregate with correct mathematical sign
    if (cat === "sales") {
      salesItems.push({ name: l.ledgerName, amount: l.credit - l.debit, ledgerId: l.ledgerId });
    } else if (cat === "sales_return") {
      salesReturnItems.push({ name: l.ledgerName, amount: l.debit - l.credit, ledgerId: l.ledgerId });
    } else if (cat === "purchase") {
      purchaseItems.push({ name: l.ledgerName, amount: l.debit - l.credit, ledgerId: l.ledgerId });
    } else if (cat === "purchase_return") {
      purchaseReturnItems.push({ name: l.ledgerName, amount: l.credit - l.debit, ledgerId: l.ledgerId });
    } else if (cat === "direct_expense") {
      directExpItems.push({ name: l.ledgerName, amount: l.debit - l.credit, ledgerId: l.ledgerId });
    } else if (cat === "direct_income") {
      directIncItems.push({ name: l.ledgerName, amount: l.credit - l.debit, ledgerId: l.ledgerId });
    } else if (cat === "indirect_expense") {
      indirectExpItems.push({ name: l.ledgerName, amount: l.debit - l.credit, ledgerId: l.ledgerId });
    } else if (cat === "indirect_income") {
      indirectIncItems.push({ name: l.ledgerName, amount: l.credit - l.debit, ledgerId: l.ledgerId });
    }
  }

  const sort = (arr: { name: string; amount: number; ledgerId?: number }[]) =>
    arr.sort((a, b) => a.name.localeCompare(b.name));
  [salesItems, salesReturnItems, purchaseItems, purchaseReturnItems, directExpItems, directIncItems, indirectExpItems, indirectIncItems].forEach(sort);

  // ── Calculation Totals ──────────────────────────────────────────────────────
  const salesGrossTotal = salesItems.reduce((s, i) => s + i.amount, 0);
  const salesReturnTotal = salesReturnItems.reduce((s, i) => s + i.amount, 0);
  const netSalesTotal = salesGrossTotal - salesReturnTotal;

  const purchaseGrossTotal = purchaseItems.reduce((s, i) => s + i.amount, 0);
  const purchaseReturnTotal = purchaseReturnItems.reduce((s, i) => s + i.amount, 0);
  const netPurchaseTotal = purchaseGrossTotal - purchaseReturnTotal;

  const directExpTotal = directExpItems.reduce((s, i) => s + i.amount, 0);
  const directIncTotal = directIncItems.reduce((s, i) => s + i.amount, 0);

  const drSide1 = openingStock + netPurchaseTotal + directExpTotal;
  const crSide1 = netSalesTotal + directIncTotal + closingStock;
  const grossProfit = crSide1 - drSide1; // > 0 = GP, < 0 = GL

  // ── P&L Account totals ──────────────────────────────────────────────────────
  const indirectExpTotal = indirectExpItems.reduce((s, i) => s + i.amount, 0);
  const indirectIncTotal = indirectIncItems.reduce((s, i) => s + i.amount, 0);

  const grossLossBF = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const grossProfitBF = grossProfit > 0 ? grossProfit : 0;

  const drSide2 = grossLossBF + indirectExpTotal;
  const crSide2 = grossProfitBF + indirectIncTotal;
  const netProfit = crSide2 - drSide2; // > 0 = NP, < 0 = NL

  // ── Unified totals for aligned grid bottoms ─────────────────────────────────
  const tradingTotal = grossProfit > 0 ? crSide1 : drSide1;
  const plTotal = netProfit > 0 ? crSide2 : drSide2;

  return (
    <div className="space-y-6 select-none">
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            aside, header, nav, .no-print, [role="dialog"] { display:none!important; }
            html,body,#__next,main {
              background:white!important; color:black!important;
              overflow:visible!important; height:auto!important;
              min-height:0!important; margin:0!important; padding:0!important;
            }
            .print-area {
              position:fixed!important; top:0!important; left:0!important;
              width:100%!important; height:100%!important;
              padding:8mm!important; box-sizing:border-box!important;
              background:white!important; z-index:99999!important;
            }
            @page { size:A4 landscape; margin:0; }
          }
        `,
      }} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Trading &amp; Profit &amp; Loss A/c</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(fromParam)} to {fmtDate(toParam)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setDetailed((d) => !d)} className="flex items-center gap-2">
            {detailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {detailed ? "Condensed View" : "Detailed View"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPeriodModal(true)}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Period
          </Button>
          <Button
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Main Report Table Grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm font-sans">
        {/* Print-only Header */}
        <div className="hidden print:block text-center py-6 border-b border-border bg-card">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            {company.companyName}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-1">
            Trading &amp; Profit &amp; Loss A/c
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {fmtDate(fromParam)} to {fmtDate(toParam)}
          </p>
        </div>

        {/* Top Header Box to mimic Tally style */}
        <div className="grid grid-cols-3 bg-muted/50 text-muted-foreground px-4 py-2.5 text-xs font-bold border-b border-border uppercase tracking-wider no-print">
          <div>Trading &amp; P&amp;L A/c</div>
          <div className="text-center text-foreground font-semibold">{company.companyName}</div>
          <div className="text-right font-bold">
            {fmtDate(fromParam)} to {fmtDate(toParam)}
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {/* Left Side Header */}
          <div className="flex items-center p-3 border-r border-border bg-muted/20">
            <span className="flex-1 font-bold text-sm text-foreground">Expenditures</span>
            <span className="w-36 text-right pr-4 font-normal text-xs normal-case text-muted-foreground"></span>
            <span className="w-36 text-right font-semibold text-xs normal-case text-muted-foreground">
              {fmtDate(fromParam)} to {fmtDate(toParam)}
            </span>
          </div>
          {/* Right Side Header */}
          <div className="flex items-center p-3 pl-4 bg-muted/20">
            <span className="flex-1 font-bold text-sm text-foreground">Incomes</span>
            <span className="w-36 text-right pr-4 font-normal text-xs normal-case text-muted-foreground"></span>
            <span className="w-36 text-right font-semibold text-xs normal-case text-muted-foreground">
              {fmtDate(fromParam)} to {fmtDate(toParam)}
            </span>
          </div>
        </div>

        {/* ==================== 1. TRADING ACCOUNT SECTION ==================== */}
        <div className="grid grid-cols-2 text-sm">
          {/* Trading Left Column (Expenditures / Debits) */}
          <div className="col-span-1 flex flex-col border-r border-border justify-between">
            <div className="flex-1 py-2 border-b border-border/50">
              {/* Opening Stock */}
              <GroupSection
                title="Opening Stock"
                items={[{ name: "Stock A/c", amount: openingStock }]}
                total={openingStock}
                detailed={detailed}
              />

              {/* Purchase Accounts and returns subtracted */}
              <AccountWithReturnSection
                title="Purchase Accounts"
                mainItems={purchaseItems}
                returnItems={purchaseReturnItems}
                grossTotal={purchaseGrossTotal}
                returnTotal={purchaseReturnTotal}
                netTotal={netPurchaseTotal}
                detailed={detailed}
              />

              {/* Direct Expenses */}
              <GroupSection
                title="Direct Expenses"
                items={directExpItems}
                total={directExpTotal}
                detailed={detailed}
              />

              {/* Gross Profit (if crSide1 > drSide1) */}
              {grossProfit > 0 && (
                <NetResultRow label="Gross Profit c/o" amount={grossProfit} color="profit" />
              )}
            </div>

            {/* Trading Total Row for Left Side */}
            <div className="bg-muted/10 p-3 flex items-center justify-between font-bold border-b border-double border-b-4 border-border">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{fmt(tradingTotal)}</div>
              </div>
            </div>
          </div>

          {/* Trading Right Column (Incomes / Credits) */}
          <div className="col-span-1 flex flex-col justify-between">
            <div className="flex-1 py-2 border-b border-border/50">
              {/* Sales Accounts and returns subtracted */}
              <AccountWithReturnSection
                title="Sales Accounts"
                mainItems={salesItems}
                returnItems={salesReturnItems}
                grossTotal={salesGrossTotal}
                returnTotal={salesReturnTotal}
                netTotal={netSalesTotal}
                detailed={detailed}
              />

              {/* Direct Income */}
              <GroupSection
                title="Direct Income"
                items={directIncItems}
                total={directIncTotal}
                detailed={detailed}
              />

              {/* Closing Stock */}
              <GroupSection
                title="Closing Stock"
                items={[{ name: "Stock A/c", amount: closingStock }]}
                total={closingStock}
                detailed={detailed}
              />

              {/* Gross Loss (if drSide1 > crSide1) */}
              {grossProfit < 0 && (
                <NetResultRow label="Gross Loss c/o" amount={Math.abs(grossProfit)} color="loss" />
              )}
            </div>

            {/* Trading Total Row for Right Side */}
            <div className="bg-muted/10 p-3 flex items-center justify-between font-bold border-b border-double border-b-4 border-border">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{fmt(tradingTotal)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Divider Row */}
        <div className="grid grid-cols-2 bg-muted/40 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground no-print border-t border-border">
          <div className="p-2 border-r border-border">Profit &amp; Loss Account (Indirect)</div>
          <div className="p-2 pl-4">Profit &amp; Loss Account (Indirect)</div>
        </div>

        {/* ==================== 2. PROFIT & LOSS ACCOUNT SECTION ==================== */}
        <div className="grid grid-cols-2 text-sm min-h-[220px]">
          {/* P&L Left Column (Indirect Expenditures) */}
          <div className="col-span-1 flex flex-col border-r border-border justify-between">
            <div className="flex-1 py-2">
              {/* Gross Loss b/f */}
              {grossProfit < 0 && (
                <NetResultRow label="Gross Loss b/f" amount={Math.abs(grossProfit)} color="loss" />
              )}

              {/* Indirect Expenses */}
              <GroupSection
                title="Indirect Expenses"
                items={indirectExpItems}
                total={indirectExpTotal}
                detailed={detailed}
              />

              {/* Net Profit (only if netProfit > 0) */}
              {netProfit > 0 && (
                <NetResultRow label="Nett Profit" amount={netProfit} color="profit" />
              )}
            </div>

            {/* P&L Total Row for Left Side */}
            <div className="border-t border-border bg-muted/20 p-3 flex items-center justify-between font-bold border-b-4 border-double">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{fmt(plTotal)}</div>
              </div>
            </div>
          </div>

          {/* P&L Right Column (Indirect Incomes) */}
          <div className="col-span-1 flex flex-col justify-between">
            <div className="flex-1 py-2">
              {/* Gross Profit b/f */}
              {grossProfit > 0 && (
                <NetResultRow label="Gross Profit b/f" amount={grossProfit} color="profit" />
              )}

              {/* Indirect Incomes */}
              <GroupSection
                title="Indirect Incomes"
                items={indirectIncItems}
                total={indirectIncTotal}
                detailed={detailed}
              />

              {/* Net Loss (only if netProfit < 0) */}
              {netProfit < 0 && (
                <NetResultRow label="Nett Loss" amount={Math.abs(netProfit)} color="loss" />
              )}
            </div>

            {/* P&L Total Row for Right Side */}
            <div className="border-t border-border bg-muted/20 p-3 flex items-center justify-between font-bold border-b-4 border-double">
              <span>Total</span>
              <div className="flex">
                <div className="w-36"></div>
                <div className="w-36 text-right font-mono text-base">{fmt(plTotal)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Period Dialog */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pl-from" className="text-right">From</Label>
              <Input
                id="pl-from"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pl-to" className="text-right">To</Label>
              <Input
                id="pl-to"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
            <Button onClick={handleApply}>Apply Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProfitLossClient(props: ProfitLossClientProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Profit &amp; Loss</span></div>
      }
    >
      <ProfitLossContent {...props} />
    </Suspense>
  );
}
