"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, ArrowLeft } from "lucide-react";

interface SupplierOption {
  supplierId: number;
  supplierName: string;
  gstNo: string | null;
  address: string | null;
}

interface ProductOption {
  productId: number;
  productName: string;
  productCode: string;
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
    productId: number;
    productName: string;
    productCode: string;
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
  productId: string;
  productName: string;
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
}

export default function PurchaseReturnClient({
  company,
  suppliers,
  products,
  ledgers,
  taxRates,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  suppliers: SupplierOption[];
  products: ProductOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [voucherNo, setVoucherNo] = useState(""); // Debite Note / Purchase Return No
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  // Logistics
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");

  // API State for Invoices
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  // Line items for return
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch supplier invoices
  useEffect(() => {
    if (!selectedSupplier) {
      setInvoices([]);
      setLineItems([]);
      setSelectedInvoiceIds([]);
      return;
    }

    async function fetchInvoices() {
      setLoadingInvoices(true);
      try {
        const res = await fetch(`/api/vouchers?type=purchase&partyId=${selectedSupplier}&includeItems=true`);
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
  }, [selectedSupplier]);

  // Handle invoice checkbox toggle
  function handleToggleInvoice(invoice: PurchaseInvoice) {
    const isSelected = selectedInvoiceIds.includes(invoice.voucherId);
    let newIds = [];
    if (isSelected) {
      newIds = selectedInvoiceIds.filter((id) => id !== invoice.voucherId);
      // Remove lines from this invoice
      setLineItems((items) => items.filter((item) => item.invoiceNo !== invoice.voucherNo));
    } else {
      newIds = [...selectedInvoiceIds, invoice.voucherId];
      // Add lines from this invoice
      const newItems: ReturnLineItem[] = invoice.lineItems.map((line) => ({
        id: crypto.randomUUID(),
        productId: String(line.productId),
        productName: line.productName || "Product",
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
      }));
      setLineItems((items) => [...items, ...newItems]);
    }
    setSelectedInvoiceIds(newIds);
  }

  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const companyGst = company?.gstNo || "";
    const supplier = suppliers.find((s) => String(s.supplierId) === selectedSupplier);
    const supplierGst = supplier?.gstNo || "";
    if (!companyGst || !supplierGst) return false;
    return companyGst.slice(0, 2) !== supplierGst.slice(0, 2);
  }, [company, selectedSupplier, suppliers]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;

      const amount = Math.round((qty * rate * fold / 100) * 100) / 100;
      const totalTax = Math.round((amount * gstRatePercent) / 100 * 100) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = totalTax;
      } else {
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax - cgst) * 100) / 100;
      }

      return { amount, cgst, sgst, igst, totalTax, net: amount + totalTax };
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
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedSupplier || !voucherNo) {
      setMessage("Select supplier and enter debit note/PR number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.productId && Number(line.quantity) > 0 && Number(line.rate) >= 0);
    if (validLines.length === 0) {
      setMessage("Add at least one line item with valid quantity and rate.");
      return;
    }

    // Validate quantities do not exceed original inward quantity
    for (const line of validLines) {
      if (Number(line.quantity) > line.originalQuantity) {
        setMessage(`Error: Quantity returned for product in invoice ${line.invoiceNo} exceeds original purchased quantity (${line.originalQuantity}).`);
        return;
      }
      if (Number(line.pcs || 0) > line.originalPcs) {
        setMessage(`Error: PCS returned for product in invoice ${line.invoiceNo} exceeds original purchased PCS (${line.originalPcs}).`);
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "debit_note",
        voucherNo,
        voucherDate,
        partyId: Number(selectedSupplier),
        remarks: remarks || `Purchase Return - Against Invoices: ${selectedInvoiceIds.map(id => invoices.find(inv => inv.voucherId === id)?.voucherNo).join(", ")}`,
        lrNo,
        lrDate: lrDate || null,
        transport,
        lineItems: validLines.map((line) => ({
          productId: Number(line.productId),
          ledgerId: Number(line.ledgerId),
          hsnCode: line.hsnCode,
          pcs: Number(line.pcs || 0),
          quantity: Number(line.quantity),
          fold: Number(line.fold || 100),
          rate: Number(line.rate),
          gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
        })),
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

      setMessage("Purchase Return (Debit Note) created successfully.");
      setVoucherNo("");
      setRemarks("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLineItems([]);
      setSelectedInvoiceIds([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Purchase Return (Debit Note)</h1>
          <p className="text-sm text-muted-foreground">Record returns against one or multiple purchase invoices.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Supplier & Invoice Selection */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party & Invoices</h2>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                    {s.supplierName} {s.gstNo ? `(${s.gstNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSupplier && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold uppercase text-foreground">Select Invoices</Label>
              {loadingInvoices ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading invoices...
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No purchase invoices found for this supplier.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-2 border border-border rounded p-2 bg-muted/10">
                  {invoices.map((inv) => (
                    <label key={inv.voucherId} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(inv.voucherId)}
                        onChange={() => handleToggleInvoice(inv)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>{inv.voucherNo} ({new Date(inv.voucherDate).toLocaleDateString()}) - ₹{Number(inv.netAmount).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Document Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">DR. Note / PR No.</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. PR-001" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Return Date</Label>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Return reasons" className="h-9" />
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                  <th className="py-2.5 px-2">Invoice No</th>
                  <th className="py-2.5 px-2">Product Name</th>
                  <th className="py-2.5 px-2">Original Qty</th>
                  <th className="py-2.5 px-2">Return PCS</th>
                  <th className="py-2.5 px-2">Return Qty (Mtr)</th>
                  <th className="py-2.5 px-2">Fold %</th>
                  <th className="py-2.5 px-2">Rate</th>
                  <th className="py-2.5 px-2 text-right">Taxable</th>
                  <th className="py-2.5 px-2 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {lineItems.map((line, idx) => {
                  const totals = lineTotals[idx] || { amount: 0 };
                  return (
                    <tr key={line.id} className="hover:bg-muted/10">
                      <td className="py-2 px-2 text-xs font-semibold text-muted-foreground">{line.invoiceNo}</td>
                      <td className="py-2 px-2 text-xs font-medium text-foreground">{line.productName}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {line.originalPcs} PCS / {line.originalQuantity} Mtr
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={line.pcs}
                          onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                          className="h-8 text-xs w-20"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                          className="h-8 text-xs w-24"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={line.fold}
                          onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                          className="h-8 text-xs w-16"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={line.rate}
                          onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                          className="h-8 text-xs w-24"
                        />
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-right text-foreground">
                        ₹{totals.amount.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.id)}
                          className="text-danger hover:bg-danger/10 hover:text-danger h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Summary and Tax Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-3 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">GST Tax Breakdown</h2>
          
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">CGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.cgst.toFixed(2)}</div>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">SGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.sgst.toFixed(2)}</div>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">IGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.igst.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Value:</span>
              <span className="font-semibold">₹{grandTotals.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total GST:</span>
              <span className="font-semibold text-warning">₹{grandTotals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
              <span>Grand Total:</span>
              <span className="text-primary">₹{grandTotals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSubmit} disabled={saving || !canCreate} className="w-full h-10 font-bold uppercase">
              {saving ? "Saving Return..." : "Save Purchase Return"}
            </Button>
          </div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}
    </div>
  );
}
