"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, FileText } from "lucide-react";
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

interface PastVoucher {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  remarks: string | null;
  party: { name: string; gstNo: string | null; address: string | null } | null;
}

const EMPTY_LINE: LineItem = { id: "", productId: "", ledgerId: "", quantity: "0", rate: "0", gstRateId: "" };

const fmt = (n: number) => `₹${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export default function SalesClient({
  company,
  customers,
  products,
  ledgers,
  taxRates,
  canCreate,
  pastVouchers: initialPastVouchers,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  customers: CustomerOption[];
  products: ProductOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
  pastVouchers: PastVoucher[];
}) {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE, id: crypto.randomUUID() }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);
  const [pastVouchers, setPastVouchers] = useState<PastVoucher[]>(initialPastVouchers);

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
      (acc, item) => ({ amount: acc.amount + item.amount, tax: acc.tax + item.tax, total: acc.total + item.total }),
      { amount: 0, tax: 0, total: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function openReprint(v: PastVoucher) {
    setPrintVoucher({
      voucher: {
        voucherNo: v.voucherNo,
        voucherDate: v.voucherDate,
        voucherType: "sale",
        remarks: v.remarks,
        totalAmount: v.totalAmount,
        taxAmount: v.taxAmount,
        netAmount: v.netAmount,
      },
      party: v.party ?? { name: "Walk-in Customer", gstNo: null, address: null },
      lines: [], // no line-level detail in list view
    });
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

      const customer = customers.find((c) => String(c.customerId) === selectedCustomer);
      const newVoucher: PastVoucher = {
        voucherId: responseData.voucherId,
        voucherNo: body.voucherNo,
        voucherDate: body.voucherDate,
        status: "posted",
        totalAmount: grandTotals.amount,
        taxAmount: grandTotals.tax,
        netAmount: grandTotals.total,
        remarks,
        party: customer ? { name: customer.customerName, gstNo: customer.gstNo, address: customer.address } : null,
      };

      // Prepend to list and open invoice sheet
      setPastVouchers((prev) => [newVoucher, ...prev]);

      const invoiceLines = validLines.map((line) => {
        const prod = products.find((p) => String(p.productId) === line.productId);
        const tr = taxRates.find((t) => String(t.taxRateId) === line.gstRateId);
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
      });

      setPrintVoucher({
        voucher: { ...newVoucher, voucherType: "sale" },
        party: newVoucher.party ?? { name: "Walk-in Customer", gstNo: null, address: null },
        lines: invoiceLines,
      });

      setInvoiceNo("");
      setRemarks("");
      setLineItems([{ ...EMPTY_LINE, id: crypto.randomUUID() }]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Entry Form */}
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

      {/* Line Items */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <p className="text-xs text-muted-foreground">Add product lines and tax details.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLineItems((items) => [...items, { ...EMPTY_LINE, id: crypto.randomUUID() }])}>
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
                  <div className="text-sm font-bold text-foreground">{fmt(totals.total)}</div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setLineItems((items) => items.filter((item) => item.id !== line.id))} className="text-danger hover:bg-danger/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Amount</div>
          <div className="mt-2 text-xl font-bold text-foreground">{fmt(grandTotals.amount)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Tax</div>
          <div className="mt-2 text-xl font-bold text-foreground">{fmt(grandTotals.tax)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Net Total</div>
          <div className="mt-2 text-xl font-bold text-foreground">{fmt(grandTotals.total)}</div>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border p-4 text-sm ${message.includes("success") ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted/50 text-muted-foreground"}`}>
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving || !canCreate}>
          {saving ? "Saving..." : "Save Sales Voucher"}
        </Button>
      </div>

      {/* Past Vouchers List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Sales History</h2>
            <p className="text-xs text-muted-foreground">Last 50 posted sales vouchers</p>
          </div>
        </div>

        {pastVouchers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No sales vouchers yet. Create your first sale above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Voucher No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3 text-right">Taxable</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Net Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pastVouchers.map((v) => (
                <tr key={v.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{v.voucherNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.voucherDate}</td>
                  <td className="px-4 py-3 text-foreground">{v.party?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground italic text-xs max-w-[160px] truncate">{v.remarks || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(v.totalAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(v.taxAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{fmt(v.netAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={v.status === "posted" ? "default" : "secondary"} className="text-xs capitalize">
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon-sm" title="Preview Invoice" onClick={() => openReprint(v)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice Sheet */}
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
