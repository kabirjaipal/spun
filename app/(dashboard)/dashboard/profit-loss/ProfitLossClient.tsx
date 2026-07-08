"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, ChevronDown, ChevronRight } from "lucide-react";
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
  v === 0
    ? ""
    : new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(v));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });

// Collapsible group row + ledger rows — Tally style
function GroupSection({
  title,
  items,
  total,
  detailed,
  indented = false,
}: {
  title: string;
  items: { name: string; amount: number }[];
  total: number;
  detailed: boolean;
  indented?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (total === 0 && items.every((i) => i.amount === 0)) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex justify-between items-center py-2 pr-4 text-[13px] font-bold text-foreground hover:bg-muted/20 transition-colors no-print-hover ${
          indented ? "pl-8" : "pl-4"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {detailed
            ? open
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : null}
          {title}
        </span>
        {(!detailed || !open) && (
          <span className="font-mono tabular-nums">{fmt(total)}</span>
        )}
      </button>

      {detailed && open && (
        <div>
          {items.map((it) =>
            it.amount !== 0 ? (
              <div
                key={it.name}
                className="flex justify-between items-center py-1.5 pl-12 pr-4 text-xs text-foreground/80 font-sans"
              >
                <span>{it.name}</span>
                <span className="font-mono tabular-nums">{fmt(it.amount)}</span>
              </div>
            ) : null
          )}
          {/* Group sub-total right-aligned */}
          <div className="flex justify-end pr-4 pb-1">
            <span className="font-mono text-[13px] font-bold tabular-nums border-t border-border/50 pt-1 min-w-[100px] text-right">
              {fmt(total)}
            </span>
          </div>
        </div>
      )}
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

  // ── resolve top-level ancestor group name ──────────────────────────────────
  const topGroup = (groupId: number | null): string => {
    if (!groupId) return "";
    let cur = groupId;
    for (let i = 0; i < 10; i++) {
      const g = groups.find((x) => x.groupId === cur);
      if (!g) return "";
      if (!g.parentGroupId) return g.groupName.toLowerCase();
      cur = g.parentGroupId;
    }
    return "";
  };

  // ── classify ledgers ────────────────────────────────────────────────────────
  const salesItems: { name: string; amount: number }[] = [];
  const purchaseItems: { name: string; amount: number }[] = [];
  const directExpItems: { name: string; amount: number }[] = [];
  const directIncItems: { name: string; amount: number }[] = [];
  const indirectExpItems: { name: string; amount: number }[] = [];
  const indirectIncItems: { name: string; amount: number }[] = [];

  for (const l of ledgers) {
    const net = l.debit - l.credit;
    const grp = topGroup(l.groupId);

    if (l.ledgerType === "sales") {
      salesItems.push({ name: l.ledgerName, amount: l.credit - l.debit });
    } else if (l.ledgerType === "income") {
      const isDirect =
        grp.includes("direct") ||
        grp.includes("trading") ||
        grp.includes("revenue");
      if (isDirect) directIncItems.push({ name: l.ledgerName, amount: l.credit - l.debit });
      else indirectIncItems.push({ name: l.ledgerName, amount: l.credit - l.debit });
    } else if (l.ledgerType === "purchase") {
      purchaseItems.push({ name: l.ledgerName, amount: net });
    } else if (l.ledgerType === "expense") {
      const isDirect =
        grp.includes("direct") ||
        grp.includes("trading") ||
        grp.includes("manufacturing");
      if (isDirect) directExpItems.push({ name: l.ledgerName, amount: net });
      else indirectExpItems.push({ name: l.ledgerName, amount: net });
    }
  }

  const sort = (arr: { name: string; amount: number }[]) =>
    arr.sort((a, b) => a.name.localeCompare(b.name));
  [salesItems, purchaseItems, directExpItems, directIncItems, indirectExpItems, indirectIncItems].forEach(sort);

  // ── Trading Account totals ──────────────────────────────────────────────────
  const salesTotal = salesItems.reduce((s, i) => s + i.amount, 0);
  const purchaseTotal = purchaseItems.reduce((s, i) => s + i.amount, 0);
  const directExpTotal = directExpItems.reduce((s, i) => s + i.amount, 0);
  const directIncTotal = directIncItems.reduce((s, i) => s + i.amount, 0);

  const drSide1 = openingStock + purchaseTotal + directExpTotal;
  const crSide1 = salesTotal + closingStock + directIncTotal;
  const grossProfit = crSide1 - drSide1; // > 0 = GP, < 0 = GL
  const tradingTotal = Math.max(drSide1, crSide1);

  // ── P&L Account totals ──────────────────────────────────────────────────────
  const indirectExpTotal = indirectExpItems.reduce((s, i) => s + i.amount, 0);
  const indirectIncTotal = indirectIncItems.reduce((s, i) => s + i.amount, 0);

  const grossLossBF = grossProfit < 0 ? Math.abs(grossProfit) : 0;
  const grossProfitBF = grossProfit > 0 ? grossProfit : 0;
  const drSide2 = grossLossBF + indirectExpTotal;
  const crSide2 = grossProfitBF + indirectIncTotal;
  const netProfit = crSide2 - drSide2; // > 0 = NP, < 0 = NL
  const plTotal = Math.max(drSide2, crSide2);

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const Row = ({
    label,
    amount,
    bold,
    color,
    indent,
  }: {
    label: string;
    amount: number;
    bold?: boolean;
    color?: "profit" | "loss";
    indent?: boolean;
  }) => (
    <div
      className={`flex justify-between items-center py-2 pr-4 text-[13px]
        ${indent ? "pl-10" : "pl-4"}
        ${bold ? "font-bold" : "font-normal"}
        ${color === "profit" ? "text-green-700 dark:text-green-400 font-bold" : ""}
        ${color === "loss" ? "text-red-600 dark:text-red-400 font-bold" : ""}
        ${!color ? "text-foreground" : ""}
      `}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{amount !== 0 ? fmt(amount) : ""}</span>
    </div>
  );

  const Divider = ({ total }: { total: number }) => (
    <div className="border-t border-border mt-0.5 mx-4 flex justify-end">
      <span className="font-mono font-bold text-[13px] tabular-nums py-2 text-foreground">
        {fmt(total)}
      </span>
    </div>
  );

  const GrandTotal = ({ total }: { total: number }) => (
    <div className="flex justify-between items-center py-2.5 px-4 border-t-2 border-double border-border bg-muted/10 font-black text-[13px] text-foreground">
      <span className="uppercase tracking-wide">Total</span>
      <span className="font-mono tabular-nums">{fmt(total)}</span>
    </div>
  );

  const ColHeader = () => (
    <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Particulars</span>
    </div>
  );

  return (
    <div className="space-y-5 select-none">
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Profit &amp; Loss A/c</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(fromParam)} to {fmtDate(toParam)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetailed((d) => !d)}>
            {detailed ? "Condensed" : "Detailed"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPeriodModal(true)}
            className="flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Period
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* ── Report ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm font-sans">

        {/* Company info header — always visible on screen AND in print */}
        <div className="text-center py-5 border-b border-border bg-muted/10">
          <h2 className="text-lg font-black uppercase tracking-widest text-foreground">{company.companyName}</h2>
          {company.address && <p className="text-xs text-muted-foreground mt-0.5">{company.address}</p>}
          {company.gstNo && <p className="text-xs text-muted-foreground">GSTIN: {company.gstNo}</p>}
          <p className="text-sm font-bold uppercase tracking-widest text-foreground mt-2">Profit &amp; Loss Account</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(fromParam)} to {fmtDate(toParam)}</p>
        </div>

        {/* ── TRADING ACCOUNT separator ─────────────────────────────────── */}
        <div className="px-3 py-1 bg-muted/30 border-b border-t border-border text-[10px] font-black uppercase tracking-widest text-center text-muted-foreground">
          Trading Account
        </div>

        {/* Trading: two columns */}
        <div className="grid grid-cols-2 border-b-2 border-double border-border">
          {/* Dr side */}
          <div className="border-r border-border">
            <ColHeader />

            {/* Opening Stock */}
            {openingStock > 0 && (
              <Row label="Opening Stock" amount={openingStock} bold />
            )}
            {detailed && openingStock > 0 && (
              <Row label="Stock A/c" amount={openingStock} indent />
            )}

            {/* Purchase Accounts */}
            <GroupSection
              title="Purchase Accounts"
              items={purchaseItems}
              total={purchaseTotal}
              detailed={detailed}
            />

            {/* Direct Expenses */}
            <GroupSection
              title="Direct Expenses"
              items={directExpItems}
              total={directExpTotal}
              detailed={detailed}
            />

            {/* Gross Profit b/f (only if crSide1 > drSide1) */}
            {grossProfit > 0 && (
              <Row label="Gross Profit b/f" amount={grossProfit} color="profit" />
            )}

            <Divider total={tradingTotal} />
          </div>

          {/* Cr side */}
          <div>
            <ColHeader />

            {/* Sales */}
            <GroupSection
              title="Sales Accounts"
              items={salesItems}
              total={salesTotal}
              detailed={detailed}
            />

            {/* Closing Stock */}
            {closingStock > 0 && (
              <Row label="Closing Stock" amount={closingStock} bold />
            )}
            {detailed && closingStock > 0 && (
              <Row label="Stock A/c" amount={closingStock} indent />
            )}

            {/* Direct Income */}
            {directIncItems.length > 0 && (
              <GroupSection
                title="Direct Income"
                items={directIncItems}
                total={directIncTotal}
                detailed={detailed}
              />
            )}

            {/* Gross Loss c/o (only if drSide1 > crSide1) */}
            {grossProfit < 0 && (
              <Row label="Gross Loss c/o" amount={Math.abs(grossProfit)} color="loss" />
            )}

            <Divider total={tradingTotal} />
          </div>
        </div>

        {/* ── P&L ACCOUNT separator ─────────────────────────────────────── */}
        <div className="px-3 py-1 bg-muted/30 border-b border-border text-[10px] font-black uppercase tracking-widest text-center text-muted-foreground">
          Profit &amp; Loss Account
        </div>

        {/* P&L: two columns */}
        <div className="grid grid-cols-2">
          {/* Dr side */}
          <div className="border-r border-border">
            <ColHeader />

            {/* Gross Loss b/f */}
            {grossLossBF > 0 && (
              <Row label="Gross Loss b/f" amount={grossLossBF} color="loss" />
            )}

            {/* Indirect Expenses */}
            <GroupSection
              title="Indirect Expenses"
              items={indirectExpItems}
              total={indirectExpTotal}
              detailed={detailed}
            />

            {/* Net Profit */}
            {netProfit > 0 && (
              <Row label="Net Profit" amount={netProfit} color="profit" />
            )}

            <GrandTotal total={plTotal > 0 ? plTotal : drSide2} />
          </div>

          {/* Cr side */}
          <div>
            <ColHeader />

            {/* Gross Profit b/f */}
            {grossProfitBF > 0 && (
              <Row label="Gross Profit b/f" amount={grossProfitBF} color="profit" />
            )}

            {/* Indirect Income */}
            {indirectIncItems.length > 0 && (
              <GroupSection
                title="Indirect Income"
                items={indirectIncItems}
                total={indirectIncTotal}
                detailed={detailed}
              />
            )}

            {/* Net Loss */}
            {netProfit < 0 && (
              <Row label="Net Loss" amount={Math.abs(netProfit)} color="loss" />
            )}

            <GrandTotal total={plTotal > 0 ? plTotal : crSide2} />
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
