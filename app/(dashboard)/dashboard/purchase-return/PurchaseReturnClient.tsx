"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2, Edit } from "lucide-react";

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
      const fold = 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;

      const amount = Math.round((qty * rate * fold / 100) * 100) / 100;

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

      const cgst = Math.round((amount * cgstPercent) / 100 * 100) / 100;
      const sgst = Math.round((amount * sgstPercent) / 100 * 100) / 100;
      const igst = Math.round((amount * igstPercent) / 100 * 100) / 100;

      const totalTaxVal = cgst + sgst + igst;

      return { amount, cgst, sgst, igst, cgstPercent, sgstPercent, igstPercent, totalTax: totalTaxVal, net: amount + totalTaxVal };
    });
  }, [lineItems, taxRates, isInterstate]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
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
                <SelectTrigger className="h-9">
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
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Return reasons" className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Return No.</Label>
              <Input value={voucherNo} readOnly placeholder="Fetching..." className="h-9 bg-muted cursor-not-allowed font-mono font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Return Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-9" />
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
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="Click to select/toggle purchase invoices" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((inv) => {
                          const isSelected = selectedInvoiceIds.includes(inv.voucherId);
                          return (
                            <SelectItem key={inv.voucherId} value={String(inv.voucherId)}>
                              {isSelected ? "✓ " : ""}{inv.voucherNo} ({new Date(inv.voucherDate).toLocaleDateString()}) - ₹{Number(inv.netAmount).toFixed(2)}
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
            <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="Lorry Receipt No." className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
              <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Transport</Label>
              <Input value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="Transport Service" className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Return Items Table */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">Items to Return</h2>

        {lineItems.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">Select one or more purchase invoices to populate return items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="py-2.5 px-2 w-[10%]">Invoice No</th>
                  <th className="py-2.5 px-2 w-[18%]">Item Name</th>
                  <th className="py-2.5 px-2 w-[10%]">HSN Code</th>
                  <th className="py-2.5 px-2 w-[12%]">Original Qty</th>
                  <th className="py-2.5 px-2 w-[6%] text-right">Return PCS</th>
                  <th className="py-2.5 px-2 w-[8%] text-right">Return Qty</th>
                  <th className="py-2.5 px-2 w-[6%]">Unit</th>
                  <th className="py-2.5 px-2 w-[8%] text-right">Rate</th>
                  <th className="py-2.5 px-2 w-[9%] text-right">Taxable</th>
                  <th className="py-2.5 px-2 w-[7%] text-right">CGST %</th>
                  <th className="py-2.5 px-2 w-[7%] text-right">SGST %</th>
                  <th className="py-2.5 px-2 w-[7%] text-right">IGST %</th>
                  <th className="py-2.5 px-2 w-[9%] text-right">Net Amt</th>
                  <th className="py-2.5 px-2 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {lineItems.map((line, idx) => {
                  const totals = lineTotals[idx] || { amount: 0, cgst: 0, sgst: 0, igst: 0, cgstPercent: 0, sgstPercent: 0, igstPercent: 0, net: 0 };
                  const isEditing = editingLineId === line.id;
                  return (
                    <React.Fragment key={line.id}>
                      <tr className={`hover:bg-muted/10 transition-colors ${isEditing ? "bg-primary/5 border-l-2 border-primary" : ""}`}>
                        <td className="py-2.5 px-2 text-xs font-semibold text-muted-foreground">{line.invoiceNo}</td>
                        <td className="py-2.5 px-2 text-xs font-medium text-foreground">{line.inventoryName}</td>
                        <td className="py-2.5 px-2 text-xs text-foreground">{line.hsnCode || "—"}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {line.originalPcs} PCS / {line.originalQuantity}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">{line.pcs || "0"}</td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">{line.quantity || "0.00"}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground font-medium">
                          {inventory.find((p) => String(p.inventoryId) === line.inventoryId)?.unit || "—"}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">₹{Number(line.rate || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-xs font-semibold text-right text-foreground">
                          ₹{totals.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">
                          {isInterstate ? "—" : totals.cgstPercent.toFixed(2) + "%"}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">
                          {isInterstate ? "—" : totals.sgstPercent.toFixed(2) + "%"}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-right text-foreground">
                          {!isInterstate ? "—" : totals.igstPercent.toFixed(2) + "%"}
                        </td>
                        <td className="py-2.5 px-2 text-xs font-bold text-right text-foreground">
                          ₹{totals.net.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingLineId(isEditing ? null : line.id)}
                              className={`h-8 w-8 transition-colors ${isEditing ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5"}`}
                              title="Edit Item Details"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(line.id)}
                              className="text-danger hover:bg-danger/10 hover:text-danger h-8 w-8"
                              title="Remove Item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {isEditing && (
                        <tr className="bg-primary/5 border-l-2 border-primary divide-x divide-border/20">
                          {/* Invoice No: Read only */}
                          <td className="py-2.5 px-2 text-xs font-semibold text-muted-foreground bg-muted/20">{line.invoiceNo} (Edit)</td>
                          {/* Item Name: Read only */}
                          <td className="py-2.5 px-2 text-xs font-medium text-foreground bg-muted/20">{line.inventoryName}</td>
                          {/* HSN Code: Input */}
                          <td className="py-1 px-1">
                            <Input
                              value={line.hsnCode || ""}
                              onChange={(e) => updateLine(line.id, "hsnCode", e.target.value)}
                              className="h-8 text-xs w-full p-1.5 bg-background"
                              placeholder="HSN"
                            />
                          </td>
                          {/* Original Qty: Read only */}
                          <td className="py-2.5 px-2 text-xs text-muted-foreground bg-muted/20">
                            {line.originalPcs} PCS / {line.originalQuantity}
                          </td>
                          {/* Return PCS: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              value={line.pcs || ""}
                              onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* Return Qty: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={line.quantity || ""}
                              onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* Unit: Read only */}
                          <td className="py-2.5 px-2 text-xs text-muted-foreground font-medium bg-muted/20">
                            {inventory.find((p) => String(p.inventoryId) === line.inventoryId)?.unit || "—"}
                          </td>
                          {/* Rate: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={line.rate || ""}
                              onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* Taxable: Read only */}
                          <td className="py-2.5 px-2 text-xs font-semibold text-right text-foreground bg-muted/20">
                            ₹{totals.amount.toFixed(2)}
                          </td>
                          {/* CGST %: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={isInterstate ? "0.00" : totals.cgstPercent.toFixed(2)}
                              value={isInterstate ? "" : (line.cgst || "")}
                              onChange={(e) => updateLine(line.id, "cgst", e.target.value)}
                              disabled={isInterstate}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* SGST %: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={isInterstate ? "0.00" : totals.sgstPercent.toFixed(2)}
                              value={isInterstate ? "" : (line.sgst || "")}
                              onChange={(e) => updateLine(line.id, "sgst", e.target.value)}
                              disabled={isInterstate}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* IGST %: Input */}
                          <td className="py-1 px-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={!isInterstate ? "0.00" : totals.igstPercent.toFixed(2)}
                              value={!isInterstate ? "" : (line.igst || "")}
                              onChange={(e) => updateLine(line.id, "igst", e.target.value)}
                              disabled={!isInterstate}
                              className="h-8 text-xs text-right w-full p-1.5 bg-background"
                            />
                          </td>
                          {/* Net Amt: Read only */}
                          <td className="py-2.5 px-2 text-xs font-bold text-right text-foreground bg-muted/20">
                            ₹{totals.net.toFixed(2)}
                          </td>
                          {/* Action: Done Button */}
                          <td className="py-2.5 px-2 text-center bg-muted/20">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingLineId(null)}
                              className="text-success hover:bg-success/15 hover:text-success h-8 w-8"
                              title="Done Editing"
                            >
                              <span className="font-bold text-base">✓</span>
                            </Button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Return Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSubmit} disabled={saving || !canCreate} className="h-10 px-8 font-bold uppercase">
          {saving ? "Saving Return..." : "Save Purchase Return"}
        </Button>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}
    </div>
  );
}
