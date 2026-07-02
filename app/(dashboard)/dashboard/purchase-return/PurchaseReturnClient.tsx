"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2, Edit } from "lucide-react";
import PieceMetersDialog from "@/components/PieceMetersDialog";
import { formatDate } from "@/lib/utils";

interface CompanyOption {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  address: string | null;
  state?: string | null;
}

interface InventoryOption {
  inventoryId: number;
  inventoryName: string;
  inventoryCode: string;
  unit: string;
  gstRateId: number | null;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

interface TaxRateOption {
  taxRateId: number;
  taxName: string;
  taxPercent: string;
}

interface PurchaseInvoice {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: string;
  lineItems: Array<{
    voucherItemId: number;
    inventoryId: number;
    inventoryName: string;
    inventoryCode: string;
    unit: string;
    ledgerId: number;
    hsnCode: string | null;
    pcs: number;
    quantity: string;
    fold: string;
    rate: string;
    gstRateId: number | null;
    taxableAmount: string;
    cgst: string;
    sgst: string;
    igst: string;
    netAmount: string;
    pieceMeters?: string[];
  }>;
}

interface ReturnLineItem {
  id: string;
  inventoryId: string;
  inventoryName: string;
  ledgerId: string;
  hsnCode: string;
  pcs: string;
  originalPcs: number;
  quantity: string; // meters / quantity
  originalQuantity: number;
  fold: string; // fold percentage
  rate: string;
  gstRateId: string;
  invoiceNo: string;
  cgst: string;
  sgst: string;
  igst: string;
  pieceMeters?: string[];
}

export default function PurchaseReturnClient({
  company,
  companies,
  inventory,
  ledgers,
  taxRates,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null; companyType?: string; state?: string | null };
  companies: CompanyOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [selectedCompany, setSelectedCompany] = useState("");
  const [voucherNo, setVoucherNo] = useState(""); // Purchase Return No
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=purchase_return");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) {
          setVoucherNo(data.nextVoucherNo);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Failed to fetch next voucher number:", res.status, errData);
      }
    } catch (err) {
      console.error("Error fetching next voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  // Logistics
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState(new Date().toISOString().slice(0, 10));
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");

  // API State for Invoices
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  // Line items for return & editing state
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  // Piece meters modal state
  const [activePieceLineId, setActivePieceLineId] = useState<string | null>(null);

  function handleSavePieceMeters(meters: string[]) {
    if (!activePieceLineId) return;
    const sum = meters.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== activePieceLineId) return item;
        return {
          ...item,
          pieceMeters: meters,
          quantity: sum > 0 ? sum.toFixed(4) : item.quantity,
        };
      })
    );
    setActivePieceLineId(null);
  }

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch company invoices
  useEffect(() => {
    if (!selectedCompany) {
      setInvoices([]);
      setLineItems([]);
      setSelectedInvoiceIds([]);
      setEditingLineId(null);
      return;
    }

    async function fetchInvoices() {
      setLoadingInvoices(true);
      try {
        const res = await fetch(`/api/vouchers?type=purchase&partyId=${selectedCompany}&includeItems=true`);
        if (res.ok) {
          const data = await res.json();
          setInvoices(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInvoices(false);
      }
    }
    fetchInvoices();
  }, [selectedCompany]);

  // Handle invoice dropdown/checkbox toggle
  function handleToggleInvoice(invoice: PurchaseInvoice) {
    const isSelected = selectedInvoiceIds.includes(invoice.voucherId);
    let newIds = [];
    if (isSelected) {
      newIds = selectedInvoiceIds.filter((id) => id !== invoice.voucherId);
      // Remove lines from this invoice
      setLineItems((items) => items.filter((item) => item.invoiceNo !== invoice.voucherNo));
      // Close editing panel if the item being edited was from this invoice
      setEditingLineId((currId) => {
        const item = lineItems.find((l) => l.id === currId);
        if (item && item.invoiceNo === invoice.voucherNo) {
          return null;
        }
        return currId;
      });
    } else {
      newIds = [...selectedInvoiceIds, invoice.voucherId];
      // Add lines from this invoice
      const newItems: ReturnLineItem[] = invoice.lineItems.map((line) => ({
        id: crypto.randomUUID(),
        inventoryId: String(line.inventoryId),
        inventoryName: line.inventoryName || "Item",
        ledgerId: String(line.ledgerId),
        hsnCode: line.hsnCode || "",
        pcs: String(line.pcs),
        originalPcs: line.pcs,
        quantity: String(line.quantity),
        originalQuantity: Number(line.quantity),
        fold: String(line.fold),
        rate: String(line.rate),
        gstRateId: String(line.gstRateId || ""),
        invoiceNo: invoice.voucherNo,
        cgst: "",
        sgst: "",
        igst: "",
        pieceMeters: line.pieceMeters || [],
      }));
      setLineItems((items) => [...items, ...newItems]);
    }
    setSelectedInvoiceIds(newIds);
  }

  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const subCompany = companies.find((s) => String(s.companyId) === selectedCompany);
    if (company?.state && subCompany?.state) {
      return company.state.trim().toLowerCase() !== subCompany.state.trim().toLowerCase();
    }
    const companyGst = company?.gstNo || "";
    const subCompanyGst = subCompany?.gstNo || "";
    if (!companyGst || !subCompanyGst) return false;
    return companyGst.slice(0, 2) !== subCompanyGst.slice(0, 2);
  }, [company, selectedCompany, companies]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;

      const amount = Math.round((qty * rate) * 100) / 100;
      const netAmount = Math.round(((qty * rate * fold) / 100) * 100) / 100;

      let defaultCgst = 0;
      let defaultSgst = 0;
      let defaultIgst = 0;

      if (isInterstate) {
        defaultIgst = gstRatePercent;
      } else {
        defaultCgst = gstRatePercent / 2;
        defaultSgst = gstRatePercent / 2;
      }

      const cgstPercent = isInterstate ? 0 : (line.cgst !== "" ? (Number(line.cgst) || 0) : defaultCgst);
      const sgstPercent = isInterstate ? 0 : (line.sgst !== "" ? (Number(line.sgst) || 0) : defaultSgst);
      const igstPercent = isInterstate ? (line.igst !== "" ? (Number(line.igst) || 0) : defaultIgst) : 0;

      const cgst = Math.round((netAmount * cgstPercent) / 100 * 100) / 100;
      const sgst = Math.round((netAmount * sgstPercent) / 100 * 100) / 100;
      const igst = Math.round((netAmount * igstPercent) / 100 * 100) / 100;

      const totalTaxVal = cgst + sgst + igst;

      return { amount, netAmount, cgst, sgst, igst, cgstPercent, sgstPercent, igstPercent, totalTax: totalTaxVal, net: netAmount + totalTaxVal };
    });
  }, [lineItems, taxRates, isInterstate]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        netAmount: acc.netAmount + item.netAmount,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, netAmount: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof ReturnLineItem, value: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      })
    );
  }

  function removeLine(id: string) {
    if (editingLineId === id) setEditingLineId(null);
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedCompany || !voucherNo) {
      setMessage("Select company and enter return number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId && Number(line.quantity) > 0 && Number(line.rate) >= 0);
    if (validLines.length === 0) {
      setMessage("Add at least one line item with valid quantity and rate.");
      return;
    }

    // Validate quantities do not exceed original inward quantity
    for (const line of validLines) {
      if (Number(line.quantity) > line.originalQuantity) {
        setMessage(`Error: Quantity returned for item in invoice ${line.invoiceNo} exceeds original purchased quantity (${line.originalQuantity}).`);
        return;
      }
      if (Number(line.pcs || 0) > line.originalPcs) {
        setMessage(`Error: PCS returned for item in invoice ${line.invoiceNo} exceeds original purchased PCS (${line.originalPcs}).`);
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "purchase_return",
        voucherNo,
        voucherDate,
        partyId: Number(selectedCompany),
        remarks: remarks || `Purchase Return - Against Invoices: ${selectedInvoiceIds.map(id => invoices.find(inv => inv.voucherId === id)?.voucherNo).join(", ")}`,
        lrNo,
        lrDate: lrDate || null,
        transport,
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryId: Number(line.inventoryId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode,
            pcs: Number(line.pcs || 0),
            quantity: Number(line.quantity),
            fold: Number(line.fold || 100),
            rate: Number(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals?.cgst || 0,
            sgst: totals?.sgst || 0,
            igst: totals?.igst || 0,
            pieceMeters: line.pieceMeters,
          };
        }),
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to save purchase return.");
      }

      setMessage("Purchase Return created successfully.");
      fetchNextVoucherNo();
      setRemarks("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLineItems([]);
      setSelectedInvoiceIds([]);
      setEditingLineId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 container mx-auto p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Purchase Return</h1>
          <p className="text-sm text-muted-foreground">Record returns against one or multiple purchase invoices.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party, Invoices & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party, Invoices & Document Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Company (Party)</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((s) => (
                    <SelectItem key={s.companyId} value={String(s.companyId)}>
                      {s.companyName} {s.gstNo ? `(${s.gstNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Return reasons" className="h-10" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Return No.</Label>
              <Input value={voucherNo} readOnly placeholder="Fetching..." className="h-10 bg-muted cursor-not-allowed font-mono font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Return Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-10" />
            </div>

            {selectedCompany && (
              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label className="text-xs font-semibold uppercase text-foreground">Select Invoices to Return Items From</Label>
                {loadingInvoices ? (
                  <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /><span>Loading invoices...</span></div>
                ) : invoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No purchase invoices found for this company.</p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value=""
                      onValueChange={(val) => {
                        const inv = invoices.find((i) => String(i.voucherId) === val);
                        if (inv) handleToggleInvoice(inv);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Click to select/toggle purchase invoices" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((inv) => {
                          const isSelected = selectedInvoiceIds.includes(inv.voucherId);
                          return (
                            <SelectItem key={inv.voucherId} value={String(inv.voucherId)}>
                              {isSelected ? "✓ " : ""}{inv.voucherNo} ({formatDate(inv.voucherDate)}) - ₹{Number(inv.netAmount).toFixed(2)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {selectedInvoiceIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedInvoiceIds.map((id) => {
                          const inv = invoices.find((i) => i.voucherId === id);
                          if (!inv) return null;
                          return (
                            <span
                              key={id}
                              onClick={() => handleToggleInvoice(inv)}
                              className="inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-danger/10 hover:text-danger border border-primary/20 rounded px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors"
                            >
                              {inv.voucherNo} ✕
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Shipping</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">LR No.</Label>
            <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="Lorry Receipt No." className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
              <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Transport</Label>
              <Input value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="Transport Service" className="h-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Return Items Container */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">Items to Return</h2>

        <div className="space-y-4">
          {lineItems.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-xs uppercase font-medium">
              Select one or more purchase invoices to populate return items.
            </div>
          ) : (
            lineItems.map((line, index) => {
              const totals = lineTotals[index] || { amount: 0, cgst: 0, sgst: 0, igst: 0, cgstPercent: 0, sgstPercent: 0, igstPercent: 0, net: 0, netAmount: 0 };
              const unit = inventory.find((p) => String(p.inventoryId) === line.inventoryId)?.unit || "PCS";
              return (
                <div key={line.id} className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 relative">
                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between border-b border-border pb-2 gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Invoice: <span className="text-foreground">{line.invoiceNo}</span> | Item #{index + 1}: <span className="text-foreground">{line.inventoryName}</span>
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => removeLine(line.id)}
                      className="text-danger hover:bg-danger/10 hover:text-danger h-9 px-3 text-xs uppercase font-semibold flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> Remove Row
                    </Button>
                  </div>

                  {/* Input Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* HSN Code */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">HSN Code</Label>
                      <Input
                        value={line.hsnCode || ""}
                        onChange={(e) => updateLine(line.id, "hsnCode", e.target.value)}
                        placeholder="HSN Code"
                        className="h-10"
                      />
                    </div>

                    {/* Fold % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">Fold %</Label>
                      <Input
                        type="number"
                        value={line.fold || ""}
                        onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Return PCS */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">Return PCS</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={line.pcs || ""}
                          onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                          onBlur={() => {
                            const num = parseInt(line.pcs) || 0;
                            if (num > 0 && (!line.pieceMeters || line.pieceMeters.length !== num)) {
                              setActivePieceLineId(line.id);
                            }
                          }}
                          className="h-10 text-right w-full"
                        />
                        {(parseInt(line.pcs) || 0) > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-10 px-0 flex-shrink-0"
                            onClick={() => setActivePieceLineId(line.id)}
                            title="Enter Piece Meters"
                          >
                            ⚙️
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Return Qty */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">Return Qty ({unit})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.quantity || ""}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Rate */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">Rate (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.rate || ""}
                        onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* CGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">CGST %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={isInterstate ? "0.00" : totals.cgstPercent.toFixed(2)}
                        value={isInterstate ? "" : (line.cgst || "")}
                        onChange={(e) => updateLine(line.id, "cgst", e.target.value)}
                        disabled={isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* SGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">SGST %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={isInterstate ? "0.00" : totals.sgstPercent.toFixed(2)}
                        value={isInterstate ? "" : (line.sgst || "")}
                        onChange={(e) => updateLine(line.id, "sgst", e.target.value)}
                        disabled={isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* IGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">IGST %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={!isInterstate ? "0.00" : totals.igstPercent.toFixed(2)}
                        value={!isInterstate ? "" : (line.igst || "")}
                        onChange={(e) => updateLine(line.id, "igst", e.target.value)}
                        disabled={!isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Original Qty stats */}
                    <div className="md:col-span-12">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Original Invoice Qty: <span className="font-bold text-foreground">{line.originalPcs} PCS / {line.originalQuantity} {unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculations Summary Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">Amount</span>
                      <span className="font-semibold text-foreground text-xs">₹ {totals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">Net Amount</span>
                      <span className="font-semibold text-foreground text-xs">₹ {totals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">CGST</span>
                      <span className="font-semibold text-muted-foreground text-xs">₹ {totals.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">SGST</span>
                      <span className="font-semibold text-muted-foreground text-xs">₹ {totals.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">IGST</span>
                      <span className="font-semibold text-muted-foreground text-xs">₹ {totals.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px] text-primary">Net Total</span>
                      <span className="font-bold text-foreground text-xs">₹ {totals.net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-border pt-4 gap-4 text-xs">
          <div className="space-y-1.5 text-right font-mono ml-auto">
            <div className="text-muted-foreground font-semibold uppercase">Total Return Amount:</div>
            <div className="text-lg font-black text-foreground">
              ₹ {grandTotals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Save Return Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSubmit} disabled={saving || !canCreate} className="h-10 px-8 font-bold uppercase">
          {saving ? "Saving Return..." : "Save Purchase Return"}
        </Button>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}

      {(() => {
        const activeLine = lineItems.find((l) => l.id === activePieceLineId);
        return activeLine ? (
          <PieceMetersDialog
            isOpen={!!activePieceLineId}
            onClose={() => setActivePieceLineId(null)}
            pcsCount={parseInt(activeLine.pcs) || 0}
            initialMeters={activeLine.pieceMeters || []}
            onSave={handleSavePieceMeters}
          />
        ) : null;
      })()}
    </div>
  );
}
