"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Filter, ArrowRight, Download, FileText, Layers, RefreshCw } from "lucide-react";
import { getLocalTodayString } from "@/lib/utils";

interface CompanyInfo {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  address: string | null;
}

interface JobOption {
  jobId: number;
  jobName: string;
  gstNo: string | null;
  address: string | null;
  msmeRegistered: boolean;
  msmeType: string | null;
}

interface ItemOption {
  inventoryId: number;
  inventoryName: string;
  inventoryCode: string;
  unit: string;
}

interface PurchasePartyOption {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  address: string | null;
}

interface VoucherItem {
  voucherItemId: number;
  voucherId: number;
  inventoryId: number | null;
  pcs: number;
  quantity: number;
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  netAmount: number;
}

interface Voucher {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  partyId: number | null;
  remarks: string | null;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  lotNo: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  parentVoucherId: number | null;
  fromPartyId: number | null;
  tdsRate: number | null;
  tdsAmount: number | null;
}

interface PurchaseVoucher {
  voucherId: number;
  voucherNo: string;
  invoiceNo: string | null;
  voucherDate: string;
  partyId: number | null;
  lotNo: string | null;
}

interface JobProcessClientProps {
  company: CompanyInfo;
  jobs: JobOption[];
  items: ItemOption[];
  purchaseParties: PurchasePartyOption[];
  vouchers: Voucher[];
  voucherItems: VoucherItem[];
  purchaseVouchers: PurchaseVoucher[];
  canExport: boolean;
}

export default function JobProcessClient({
  company,
  jobs,
  items,
  purchaseParties,
  vouchers,
  voucherItems,
  purchaseVouchers,
  canExport,
}: JobProcessClientProps) {
  const router = useRouter();

  // Active Report Tab: 'send', 'receipt', 'stock', 'item_summary'
  const [activeTab, setActiveTab] = useState<"send" | "receipt" | "stock" | "item_summary">("send");

  // Filters State
  const defaultDates = useMemo(() => {
    const today = new Date();
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return {
      from: `${fyStartYear}-04-01`,
      to: `${fyStartYear + 1}-03-31`,
    };
  }, []);

  const [fromDate, setFromDate] = useState(defaultDates.from);
  const [toDate, setToDate] = useState(defaultDates.to);

  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedPurchaseParty, setSelectedPurchaseParty] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<string>("all");
  const [selectedMsmeType, setSelectedMsmeType] = useState<string>("all");

  // Pre-resolve voucher purchase party details & job info
  const resolvedVouchers = useMemo(() => {
    return vouchers.map((v) => {
      // 1. Resolve parent voucher if linked
      const parentVoucher = v.parentVoucherId
        ? purchaseVouchers.find((pv) => pv.voucherId === v.parentVoucherId)
        : null;

      // 2. Fallback to matching lot number
      const lotVoucher = v.lotNo
        ? purchaseVouchers.find(
            (pv) =>
              pv.lotNo &&
              pv.lotNo.toLowerCase().trim() === v.lotNo?.toLowerCase().trim()
          )
        : null;

      const matchedPurchase = parentVoucher || lotVoucher;

      // 3. Resolve purchase party
      const purchasePartyId = v.fromPartyId || matchedPurchase?.partyId || null;
      const purchaseParty = purchasePartyId
        ? purchaseParties.find((p) => p.companyId === purchasePartyId)
        : null;

      // 4. Resolve purchase bill number
      const purchaseBillNo = matchedPurchase?.invoiceNo || matchedPurchase?.voucherNo || null;

      // Get Job details
      const job = jobs.find((j) => j.jobId === v.partyId);

      return {
        ...v,
        purchasePartyName: purchaseParty?.companyName || "—",
        purchasePartyId,
        purchaseBillNo: purchaseBillNo || "—",
        jobName: job?.jobName || "—",
        msmeType: job?.msmeType || "non_registered",
      };
    });
  }, [vouchers, purchaseVouchers, purchaseParties, jobs]);

  // Formatter for numbers
  const fmt = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  // Tab 1: Send to Job Data
  const sendToJobData = useMemo(() => {
    if (activeTab !== "send") return [];

    return resolvedVouchers
      .filter((v) => v.voucherType === "job_outward")
      .filter((v) => v.voucherDate >= fromDate && v.voucherDate <= toDate)
      .filter((v) => selectedJob === "all" || String(v.partyId) === selectedJob)
      .filter((v) => selectedPurchaseParty === "all" || String(v.purchasePartyId) === selectedPurchaseParty)
      .map((v) => {
        // Find line items
        const lines = voucherItems.filter((vi) => vi.voucherId === v.voucherId);
        
        // Filter by item if selected
        const hasItem = lines.some((l) => selectedItem === "all" || String(l.inventoryId) === selectedItem);
        if (!hasItem) return null;

        const matchedLines = lines.filter((l) => selectedItem === "all" || String(l.inventoryId) === selectedItem);
        const totalPcs = matchedLines.reduce((sum, l) => sum + l.pcs, 0);
        const totalQty = matchedLines.reduce((sum, l) => sum + l.quantity, 0);
        const itemNames = matchedLines
          .map((l) => items.find((i) => i.inventoryId === l.inventoryId)?.inventoryName || "—")
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(", ");

        return {
          ...v,
          itemNames,
          pcs: totalPcs,
          quantity: totalQty,
        };
      })
      .filter(Boolean) as any[];
  }, [activeTab, resolvedVouchers, fromDate, toDate, selectedJob, selectedPurchaseParty, selectedItem, voucherItems, items]);

  // Tab 2: Receipt from Job Data
  const receiptFromJobData = useMemo(() => {
    if (activeTab !== "receipt") return [];

    return resolvedVouchers
      .filter((v) => v.voucherType === "job_inward")
      .filter((v) => v.voucherDate >= fromDate && v.voucherDate <= toDate)
      .filter((v) => selectedJob === "all" || String(v.partyId) === selectedJob)
      .filter((v) => selectedMsmeType === "all" || v.msmeType === selectedMsmeType)
      .map((v) => {
        const lines = voucherItems.filter((vi) => vi.voucherId === v.voucherId);
        const pcs = lines.reduce((sum, l) => sum + l.pcs, 0);
        const quantity = lines.reduce((sum, l) => sum + l.quantity, 0);
        const cgst = lines.reduce((sum, l) => sum + l.cgst, 0);
        const sgst = lines.reduce((sum, l) => sum + l.sgst, 0);
        const igst = lines.reduce((sum, l) => sum + l.igst, 0);

        return {
          ...v,
          pcs,
          quantity,
          cgst,
          sgst,
          igst,
        };
      });
  }, [activeTab, resolvedVouchers, fromDate, toDate, selectedJob, selectedMsmeType, voucherItems]);

  // Balance calculations (for Tab 3 and Tab 4)
  const balances = useMemo(() => {
    // Map of key -> { issuedPcs, issuedQty, issuedAmt, receivedPcs, receivedQty, receivedAmt }
    const stockMap: Record<string, {
      jobName: string;
      jobId: number | null;
      inventoryId: number;
      itemName: string;
      issuedPcs: number;
      issuedQty: number;
      issuedAmt: number;
      receivedPcs: number;
      receivedQty: number;
      receivedAmt: number;
    }> = {};

    resolvedVouchers.forEach((v) => {
      // Filter by job / purchase party
      if (selectedJob !== "all" && String(v.partyId) !== selectedJob) return;
      if (selectedPurchaseParty !== "all" && String(v.purchasePartyId) !== selectedPurchaseParty) return;

      const lines = voucherItems.filter((vi) => vi.voucherId === v.voucherId);
      lines.forEach((line) => {
        if (!line.inventoryId) return;

        // Key is combination of job and item for Process Stock, or just item for Item Wise
        const key = `${v.partyId || 0}_${line.inventoryId}`;
        
        if (!stockMap[key]) {
          const item = items.find((i) => i.inventoryId === line.inventoryId);
          stockMap[key] = {
            jobName: v.jobName,
            jobId: v.partyId,
            inventoryId: line.inventoryId,
            itemName: item?.inventoryName || "—",
            issuedPcs: 0,
            issuedQty: 0,
            issuedAmt: 0,
            receivedPcs: 0,
            receivedQty: 0,
            receivedAmt: 0,
          };
        }

        const entry = stockMap[key];
        const lineAmt = line.taxableAmount; // rate * quantity
        if (v.voucherType === "job_outward") {
          entry.issuedPcs += line.pcs;
          entry.issuedQty += line.quantity;
          entry.issuedAmt += lineAmt;
        } else if (v.voucherType === "job_inward") {
          entry.receivedPcs += line.pcs;
          entry.receivedQty += line.quantity;
          entry.receivedAmt += lineAmt;
        }
      });
    });

    return Object.values(stockMap);
  }, [resolvedVouchers, voucherItems, selectedJob, selectedPurchaseParty, items]);

  // Tab 3: Process Stock Data
  const processStockData = useMemo(() => {
    if (activeTab !== "stock") return [];

    return balances.map((b) => {
      const balancePcs = b.issuedPcs - b.receivedPcs;
      const balanceQty = b.issuedQty - b.receivedQty;

      // Avg outward rate
      const avgRate = b.issuedQty > 0 ? b.issuedAmt / b.issuedQty : 0;
      const amount = balanceQty * avgRate;

      return {
        jobName: b.jobName,
        itemName: b.itemName,
        pcs: balancePcs,
        issuedQty: b.issuedQty,
        receivedQty: b.receivedQty,
        balanceQty,
        avgRate,
        amount,
      };
    }).filter((r) => r.issuedQty > 0 || r.receivedQty > 0);
  }, [activeTab, balances]);

  // Tab 4: Item Wise Summary Data
  const itemWiseSummaryData = useMemo(() => {
    if (activeTab !== "item_summary") return [];

    // Group balances by item only
    const itemMap: Record<number, {
      itemName: string;
      issuedPcs: number;
      issuedQty: number;
      issuedAmt: number;
      receivedPcs: number;
      receivedQty: number;
      receivedAmt: number;
    }> = {};

    balances.forEach((b) => {
      // Filter by item selection if active
      if (selectedItem !== "all" && String(b.inventoryId) !== selectedItem) return;

      if (!itemMap[b.inventoryId]) {
        itemMap[b.inventoryId] = {
          itemName: b.itemName,
          issuedPcs: 0,
          issuedQty: 0,
          issuedAmt: 0,
          receivedPcs: 0,
          receivedQty: 0,
          receivedAmt: 0,
        };
      }

      const entry = itemMap[b.inventoryId];
      entry.issuedPcs += b.issuedPcs;
      entry.issuedQty += b.issuedQty;
      entry.issuedAmt += b.issuedAmt;
      entry.receivedPcs += b.receivedPcs;
      entry.receivedQty += b.receivedQty;
      entry.receivedAmt += b.receivedAmt;
    });

    return Object.values(itemMap).map((b) => {
      const balancePcs = b.issuedPcs - b.receivedPcs;
      const balanceQty = b.issuedQty - b.receivedQty;
      const avgRate = b.issuedQty > 0 ? b.issuedAmt / b.issuedQty : 0;
      const amount = balanceQty * avgRate;

      return {
        itemName: b.itemName,
        pcs: balancePcs,
        issuedQty: b.issuedQty,
        receivedQty: b.receivedQty,
        balanceQty,
        avgRate,
        amount,
      };
    });
  }, [activeTab, balances, selectedItem]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">
            Job Process Report
          </h1>
          <p className="text-sm text-muted-foreground">
            View detailed job ledger shipments, receipts, stock levels, and item wise summary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="flex items-center gap-2 h-10 border-primary/20 text-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4" /> Print / PDF
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Sub-Navigation */}
      <div className="flex border-b border-border bg-muted/20 p-1.5 rounded-lg max-w-2xl">
        <button
          onClick={() => setActiveTab("send")}
          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-150 ${
            activeTab === "send"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Send to Job
        </button>
        <button
          onClick={() => setActiveTab("receipt")}
          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-150 ${
            activeTab === "receipt"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Receipt from Job
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-150 ${
            activeTab === "stock"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Process Stock
        </button>
        <button
          onClick={() => setActiveTab("item_summary")}
          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-150 ${
            activeTab === "item_summary"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Item Wise Summary
        </button>
      </div>

      {/* Filters Card */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Filter Report Parameters
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date range selection - only for send and receipt reports */}
          {(activeTab === "send" || activeTab === "receipt") && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </>
          )}

          {/* Job select dropdown */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Job worker</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="All Workers" />
              </SelectTrigger>
              <SelectContent searchable={true}>
                <SelectItem value="all">All Workers</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.jobId} value={String(j.jobId)}>
                    {j.jobName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Purchase Party dropdown - visible for Send, Stock, Item Summary */}
          {activeTab !== "receipt" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Purchase Party</Label>
              <Select value={selectedPurchaseParty} onValueChange={setSelectedPurchaseParty}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="All Parties" />
                </SelectTrigger>
                <SelectContent searchable={true}>
                  <SelectItem value="all">All Parties</SelectItem>
                  {purchaseParties.map((p) => (
                    <SelectItem key={p.companyId} value={String(p.companyId)}>
                      {p.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Item dropdown - visible for Send & Item Summary */}
          {(activeTab === "send" || activeTab === "item_summary") && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Name</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="All Items" />
                </SelectTrigger>
                <SelectContent searchable={true}>
                  <SelectItem value="all">All Items</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.inventoryId} value={String(i.inventoryId)}>
                      {i.inventoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* MSME type dropdown - visible only for Receipt */}
          {activeTab === "receipt" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">MSME Type</Label>
              <Select value={selectedMsmeType} onValueChange={setSelectedMsmeType}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MSME Types</SelectItem>
                  <SelectItem value="micro">Micro</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="non_registered">Non-Registered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Report Summary Card & Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        {/* Table Header / Details */}
        <div className="bg-muted/30 p-4 border-b border-border/80 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              {activeTab === "send" && "Send to Job Ledger Details"}
              {activeTab === "receipt" && "Receipt from Job Invoices"}
              {activeTab === "stock" && "Process Stock Levels"}
              {activeTab === "item_summary" && "Item Wise Process Summary"}
            </h3>
            {selectedJob !== "all" && (
              <p className="text-xs text-primary font-medium mt-0.5">
                Job worker: {jobs.find((j) => String(j.jobId) === selectedJob)?.jobName}
              </p>
            )}
          </div>
          <div className="text-xs font-medium text-muted-foreground bg-card px-2.5 py-1.5 rounded-md border border-border shadow-xs">
            Total Records:{" "}
            <span className="font-bold text-foreground">
              {activeTab === "send" && sendToJobData.length}
              {activeTab === "receipt" && receiptFromJobData.length}
              {activeTab === "stock" && processStockData.length}
              {activeTab === "item_summary" && itemWiseSummaryData.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === "send" && (
            <table className="w-full text-xs text-left min-w-[900px] font-sans">
              <thead className="bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 pl-5">Challan No.</th>
                  <th className="p-3">Challan Date</th>
                  <th className="p-3">Purchase Party</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-right">Pcs</th>
                  <th className="p-3 text-right">Meter</th>
                  <th className="p-3">Lot No.</th>
                  <th className="p-3">Purchase Bill No.</th>
                  <th className="p-3">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sendToJobData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">
                      No records found matching filters.
                    </td>
                  </tr>
                ) : (
                  sendToJobData.map((row) => (
                    <tr key={row.voucherId} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-5 font-mono font-semibold text-foreground">{row.voucherNo}</td>
                      <td className="p-3 font-mono text-muted-foreground">{row.voucherDate}</td>
                      <td className="p-3 text-foreground font-medium">{row.purchasePartyName}</td>
                      <td className="p-3 text-muted-foreground">{row.itemNames}</td>
                      <td className="p-3 text-right font-mono font-medium text-foreground">{row.pcs}</td>
                      <td className="p-3 text-right font-mono text-foreground">{fmt(row.quantity)}</td>
                      <td className="p-3 font-mono text-primary">{row.lotNo || "—"}</td>
                      <td className="p-3 font-mono text-muted-foreground">{row.purchaseBillNo}</td>
                      <td className="p-3 text-muted-foreground italic">{row.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {sendToJobData.length > 0 && (
                <tfoot className="bg-muted/20 border-t border-border font-bold text-foreground">
                  <tr>
                    <td colSpan={4} className="p-3 pl-5 text-right uppercase tracking-wider">Total:</td>
                    <td className="p-3 text-right font-mono">
                      {sendToJobData.reduce((sum, r) => sum + r.pcs, 0)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(sendToJobData.reduce((sum, r) => sum + r.quantity, 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === "receipt" && (
            <table className="w-full text-xs text-left min-w-[1000px] font-sans">
              <thead className="bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 pl-5">Voucher No.</th>
                  <th className="p-3">Bill No.</th>
                  <th className="p-3">Bill Date</th>
                  <th className="p-3 text-right">Pcs</th>
                  <th className="p-3 text-right">Meter</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">IGST</th>
                  <th className="p-3 text-right">SGST</th>
                  <th className="p-3 text-right">CGST</th>
                  <th className="p-3 text-right">TDS %</th>
                  <th className="p-3 text-right">TDS Amount</th>
                  <th className="p-3 text-right pr-5">Final Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {receiptFromJobData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-sm text-muted-foreground">
                      No records found matching filters.
                    </td>
                  </tr>
                ) : (
                  receiptFromJobData.map((row) => (
                    <tr key={row.voucherId} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-5 font-mono font-semibold text-foreground">{row.voucherNo}</td>
                      <td className="p-3 font-mono text-foreground">{row.invoiceNo || "—"}</td>
                      <td className="p-3 font-mono text-muted-foreground">{row.invoiceDate || row.voucherDate}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{row.pcs}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.quantity)}</td>
                      <td className="p-3 text-right font-mono text-foreground">{fmt(row.totalAmount)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.igst)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.sgst)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.cgst)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{row.tdsRate ? `${row.tdsRate}%` : "—"}</td>
                      <td className="p-3 text-right font-mono text-danger">{row.tdsAmount ? fmt(row.tdsAmount) : "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground pr-5">{fmt(row.netAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {receiptFromJobData.length > 0 && (
                <tfoot className="bg-muted/20 border-t border-border font-bold text-foreground">
                  <tr>
                    <td colSpan={3} className="p-3 pl-5 text-right uppercase tracking-wider">Total:</td>
                    <td className="p-3 text-right font-mono">
                      {receiptFromJobData.reduce((sum, r) => sum + r.pcs, 0)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.quantity, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.totalAmount, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.igst, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.sgst, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.cgst, 0))}
                    </td>
                    <td></td>
                    <td className="p-3 text-right font-mono text-danger">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + (r.tdsAmount || 0), 0))}
                    </td>
                    <td className="p-3 text-right font-mono pr-5">
                      {fmt(receiptFromJobData.reduce((sum, r) => sum + r.netAmount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === "stock" && (
            <table className="w-full text-xs text-left min-w-[800px] font-sans">
              <thead className="bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 pl-5">Job worker Name</th>
                  <th className="p-3">Item</th>
                  <th className="p-3 text-right">PCS (Bal)</th>
                  <th className="p-3 text-right">Issued Qty</th>
                  <th className="p-3 text-right">Received Qty</th>
                  <th className="p-3 text-right">Balance Qty</th>
                  <th className="p-3 text-right">Average Rate</th>
                  <th className="p-3 text-right pr-5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {processStockData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                      No records found matching filters.
                    </td>
                  </tr>
                ) : (
                  processStockData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-5 text-foreground font-semibold">{row.jobName}</td>
                      <td className="p-3 text-muted-foreground font-medium">{row.itemName}</td>
                      <td className={`p-3 text-right font-mono font-medium ${row.pcs > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {row.pcs}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.issuedQty)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.receivedQty)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${row.balanceQty > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {fmt(row.balanceQty)}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">₹{fmt(row.avgRate)}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground pr-5">₹{fmt(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {processStockData.length > 0 && (
                <tfoot className="bg-muted/20 border-t border-border font-bold text-foreground">
                  <tr>
                    <td colSpan={2} className="p-3 pl-5 text-right uppercase tracking-wider">Total:</td>
                    <td className="p-3 text-right font-mono">
                      {processStockData.reduce((sum, r) => sum + r.pcs, 0)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(processStockData.reduce((sum, r) => sum + r.issuedQty, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(processStockData.reduce((sum, r) => sum + r.receivedQty, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(processStockData.reduce((sum, r) => sum + r.balanceQty, 0))}
                    </td>
                    <td></td>
                    <td className="p-3 text-right font-mono pr-5">
                      {fmt(processStockData.reduce((sum, r) => sum + r.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}

          {activeTab === "item_summary" && (
            <table className="w-full text-xs text-left min-w-[700px] font-sans">
              <thead className="bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 pl-5">Item</th>
                  <th className="p-3 text-right">PCS (Bal)</th>
                  <th className="p-3 text-right">Issued Qty</th>
                  <th className="p-3 text-right">Received Qty</th>
                  <th className="p-3 text-right">Balance Qty</th>
                  <th className="p-3 text-right">Average Rate</th>
                  <th className="p-3 text-right pr-5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {itemWiseSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      No records found matching filters.
                    </td>
                  </tr>
                ) : (
                  itemWiseSummaryData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 pl-5 text-foreground font-semibold">{row.itemName}</td>
                      <td className={`p-3 text-right font-mono font-medium ${row.pcs > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {row.pcs}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.issuedQty)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{fmt(row.receivedQty)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${row.balanceQty > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {fmt(row.balanceQty)}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">₹{fmt(row.avgRate)}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground pr-5">₹{fmt(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {itemWiseSummaryData.length > 0 && (
                <tfoot className="bg-muted/20 border-t border-border font-bold text-foreground">
                  <tr>
                    <td className="p-3 pl-5 text-right uppercase tracking-wider">Total:</td>
                    <td className="p-3 text-right font-mono">
                      {itemWiseSummaryData.reduce((sum, r) => sum + r.pcs, 0)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(itemWiseSummaryData.reduce((sum, r) => sum + r.issuedQty, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(itemWiseSummaryData.reduce((sum, r) => sum + r.receivedQty, 0))}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {fmt(itemWiseSummaryData.reduce((sum, r) => sum + r.balanceQty, 0))}
                    </td>
                    <td></td>
                    <td className="p-3 text-right font-mono pr-5">
                      {fmt(itemWiseSummaryData.reduce((sum, r) => sum + r.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
