"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";

interface CustomerOption {
  customerId: number;
  customerName: string;
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
  referenceId: number | null;
}

interface TaxRateOption {
  taxRateId: number;
  taxName: string;
  taxPercent: string;
}

interface LineItem {
  id: string;
  productId: string;
  ledgerId: string;
  quantity: string;
  rate: string;
  gstRateId: string;
}

const EMPTY_LINE: LineItem = { id: "", productId: "", ledgerId: "", quantity: "0", rate: "0", gstRateId: "" };

export default function SalesClient({
  company,
  customers,
  products,
  ledgers,
  taxRates,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  customers: CustomerOption[];
  products: ProductOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE, id: crypto.randomUUID() }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const quantity = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const gstRate = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      const amount = quantity * rate;
      const tax = Math.round((amount * gstRate) / 100 * 100) / 100;
      return { amount, tax, total: amount + tax };
    });
  }, [lineItems, taxRates]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        tax: acc.tax + item.tax,
        total: acc.total + item.total,
      }),
      { amount: 0, tax: 0, total: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addLine() {
    setLineItems((items) => [...items, { ...EMPTY_LINE, id: crypto.randomUUID() }]);
  }

  function removeLine(id: string) {
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedCustomer || !invoiceNo) {
      setMessage("Select customer and voucher number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.productId && Number(line.quantity) > 0 && Number(line.rate) >= 0);
    if (validLines.length === 0) {
      setMessage("Add at least one line item with quantity and rate.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "sale",
        voucherNo: invoiceNo,
        voucherDate,
        partyId: Number(selectedCustomer),
        remarks,
        lineItems: validLines.map((line, index) => ({
          ledgerId: Number(line.ledgerId),
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          rate: Number(line.rate),
          gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
          entryType: "debit",
          sequence: index + 1,
        })),
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to create sales voucher.");
      }
      const responseData = await response.json();
      setMessage("Sales voucher created successfully.");
      setInvoiceNo("");
      setRemarks("");
      setLineItems([{ ...EMPTY_LINE, id: crypto.randomUUID() }]);

      // Capture for print modal
      const customer = customers.find(c => String(c.customerId) === selectedCustomer);
      setPrintVoucher({
        voucher: {
          voucherNo: body.voucherNo,
          voucherDate: body.voucherDate,
          voucherType: "sale",
          remarks: remarks,
          totalAmount: grandTotals.amount,
          taxAmount: grandTotals.tax,
          netAmount: grandTotals.total,
        },
        party: {
          name: customer?.customerName || "Walk-in Customer",
          gstNo: customer?.gstNo,
          address: customer?.address,
        },
        lines: validLines.map(line => {
          const prod = products.find(p => String(p.productId) === line.productId);
          const tr = taxRates.find(t => String(t.taxRateId) === line.gstRateId);
          const qty = Number(line.quantity) || 0;
          const rt = Number(line.rate) || 0;
          return {
            productCode: prod?.productCode || "PROD",
            productName: prod?.productName || "Product",
            quantity: qty,
            unit: prod?.unit || "MTR",
            rate: rt,
            amount: qty * rt,
            gstPercent: Number(tr?.taxPercent || 0),
          };
        }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Sales Voucher</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Create a sales voucher for your textile business.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Sale</Badge>
          <Badge variant="secondary">Transaction</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.customerId} value={String(customer.customerId)}>
                    {customer.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-001" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Sale of fabric goods" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <p className="text-xs text-muted-foreground">Add product lines and tax details.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {lineItems.map((line, index) => {
            const totals = lineTotals[index];
            return (
              <div key={line.id} className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end border-b border-border/50 pb-4">
                      <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</Label>
                  <Select value={line.productId} onValueChange={(value) => updateLine(line.id, "productId", value)}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.productId} value={String(product.productId)}>
                          {product.productCode} — {product.productName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ledger</Label>
                  <Select value={line.ledgerId} onValueChange={(value) => updateLine(line.id, "ledgerId", value)}>
                    <SelectTrigger><SelectValue placeholder="Select ledger" /></SelectTrigger>
                    <SelectContent>
                      {ledgers.map((ledger) => (
                        <SelectItem key={ledger.ledgerId} value={String(ledger.ledgerId)}>
                          {ledger.ledgerName} ({ledger.ledgerType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</Label>
                  <Input type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate</Label>
                  <Input type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(line.id, "rate", e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GST Rate</Label>
                  <Select value={line.gstRateId} onValueChange={(value) => updateLine(line.id, "gstRateId", value)}>
                    <SelectTrigger><SelectValue placeholder="Select tax" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {taxRates.map((rate) => (
                        <SelectItem key={rate.taxRateId} value={String(rate.taxRateId)}>
                          {rate.taxName} ({rate.taxPercent}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="text-right text-xs text-muted-foreground">Total</div>
                  <div className="text-sm font-bold text-foreground">₹{totals.total.toFixed(2)}</div>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeLine(line.id)} className="text-danger hover:bg-danger/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Amount</div>
          <div className="mt-2 text-xl font-bold text-foreground">₹{grandTotals.amount.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Tax</div>
          <div className="mt-2 text-xl font-bold text-foreground">₹{grandTotals.tax.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Net Total</div>
          <div className="mt-2 text-xl font-bold text-foreground">₹{grandTotals.total.toFixed(2)}</div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving || !canCreate}>
          {saving ? "Saving..." : "Save Sales Voucher"}
        </Button>
      </div>
      {printVoucher && (
        <PrintInvoiceModal
          isOpen={!!printVoucher}
          onClose={() => setPrintVoucher(null)}
          company={company}
          party={printVoucher.party}
          voucher={printVoucher.voucher}
          lines={printVoucher.lines}
        />
      )}
    </div>
  );
}
