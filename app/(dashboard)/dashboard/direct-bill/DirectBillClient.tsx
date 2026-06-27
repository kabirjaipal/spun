"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft, Trash2 } from "lucide-react";

interface DirectBillItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  netAmount: string;
  remarks: string | null;
  supplierName: string | null;
}

interface SupplierOption {
  supplierId: number;
  supplierName: string;
  address: string | null;
  gstNo: string | null;
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

interface LineItem {
  id: string;
  productId: string;
  ledgerId: string; // Expense/Service ledger
  hsnCode: string;
  pcs: string;
  quantity: string; // meters/qty
  fold: string; // fold %
  rate: string;
  gstRateId: string;
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  productId: "",
  ledgerId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  fold: "100",
  rate: "0",
  gstRateId: "",
});

export default function DirectBillClient({
  initialVouchers,
  company,
  suppliers,
  products,
  ledgers,
  taxRates,
  canCreate,
}: {
  initialVouchers: DirectBillItem[];
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  suppliers: SupplierOption[];
  products: ProductOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [vouchers, setVouchers] = useState<DirectBillItem[]>(initialVouchers);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [purchaseType, setPurchaseType] = useState<"goods" | "service" | "other">("service");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Filter ledgers suitable for purchase/expense debit (e.g. indirect expenses, direct expenses, purchase accounts)
  const expenseLedgers = useMemo(() => {
    return ledgers.filter(
      (l) => l.ledgerType === "expense" || l.ledgerType === "purchase" || l.ledgerType === "other"
    );
  }, [ledgers]);

  const supplierObj = useMemo(() => {
    return suppliers.find((s) => String(s.supplierId) === selectedSupplier);
  }, [selectedSupplier, suppliers]);

  const isInterstate = useMemo(() => {
    if (!company.gstNo || !supplierObj?.gstNo) return false;
    return company.gstNo.slice(0, 2) !== supplierObj.gstNo.slice(0, 2);
  }, [company.gstNo, supplierObj]);

  const lineTotals = useMemo(() => {
    return lineItems.map((item) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const fold = Number(item.fold) || 100;
      const taxable = Math.round((qty * rate * (fold / 100)) * 100) / 100;

      let taxVal = 0;
      if (item.gstRateId) {
        const rateObj = taxRates.find((r) => String(r.taxRateId) === item.gstRateId);
        if (rateObj) {
          taxVal = Math.round(((taxable * Number(rateObj.taxPercent)) / 100) * 100) / 100;
        }
      }

      return {
        taxable,
        taxVal,
        net: taxable + taxVal,
      };
    });
  }, [lineItems, taxRates]);

  const summary = useMemo(() => {
    return lineTotals.reduce(
      (acc, curr) => ({
        taxable: acc.taxable + curr.taxable,
        tax: acc.tax + curr.taxVal,
        net: acc.net + curr.net,
      }),
      { taxable: 0, tax: 0, net: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;

        if (field === "productId") {
          const prod = products.find((p) => String(p.productId) === value);
          return {
            ...item,
            productId: value,
            hsnCode: prod?.productCode || "",
            gstRateId: prod?.gstRateId ? String(prod.gstRateId) : "",
          };
        }
        return { ...item, [field]: value };
      })
    );
  }

  function addLine() {
    setLineItems((items) => [...items, EMPTY_LINE()]);
  }

  function removeLine(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedSupplier || !voucherNo) {
      setMessage("Select supplier and enter voucher number.");
      return;
    }

    const validLines = lineItems.filter((l) => l.productId && l.ledgerId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setMessage("At least one valid line with product, ledger, and quantity is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "direct_bill",
        voucherNo,
        voucherDate,
        partyId: Number(selectedSupplier),
        remarks: `[Direct Bill: ${purchaseType.toUpperCase()}] ${remarks}`,
        lineItems: validLines.map((line) => ({
          productId: Number(line.productId),
          ledgerId: Number(line.ledgerId),
          hsnCode: line.hsnCode,
          pcs: Number(line.pcs),
          quantity: Number(line.quantity),
          fold: Number(line.fold),
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
        throw new Error(json.error || "Failed to save direct bill.");
      }

      const newVoucher = await response.json();

      const added: DirectBillItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        netAmount: String(newVoucher.netAmount),
        remarks: newVoucher.remarks,
        supplierName: supplierObj ? supplierObj.supplierName : `ID ${newVoucher.partyId}`,
      };

      setVouchers([added, ...vouchers]);
      setMessage("Direct bill voucher recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setSelectedSupplier("");
      setRemarks("");
      setLineItems([EMPTY_LINE()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error saving direct bill.");
    } finally {
      setSaving(false);
    }
  }

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Direct Bill</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Input non-trading purchase/expense invoices.</p>
            </div>
          </div>
          <Badge variant="secondary">Direct Bill</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger><SelectValue placeholder="Choose Supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                      {s.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher / Invoice No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="INV-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchase Type</Label>
              <Select value={purchaseType} onValueChange={(v: any) => setPurchaseType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="goods">Goods (Non-Trading)</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="other">Other Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Details</h3>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Add Row
              </Button>
            </div>

            <div className="space-y-3">
              {lineItems.map((line, idx) => {
                const total = lineTotals[idx];
                return (
                  <div key={line.id} className="grid gap-3 grid-cols-1 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] items-end border-b border-border/20 pb-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Item / Service</Label>
                      <Select value={line.productId} onValueChange={(val) => updateLine(line.id, "productId", val)}>
                        <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.productId} value={String(p.productId)}>{p.productName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Expense Account</Label>
                      <Select value={line.ledgerId} onValueChange={(val) => updateLine(line.id, "ledgerId", val)}>
                        <SelectTrigger><SelectValue placeholder="Expense Ledger" /></SelectTrigger>
                        <SelectContent>
                          {expenseLedgers.map((l) => (
                            <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>{l.ledgerName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">PCS</Label>
                      <Input type="number" value={line.pcs} onChange={(e) => updateLine(line.id, "pcs", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Qty / Mtr</Label>
                      <Input type="number" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Rate</Label>
                      <Input type="number" value={line.rate} onChange={(e) => updateLine(line.id, "rate", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Tax Rate</Label>
                      <Select value={line.gstRateId} onValueChange={(val) => updateLine(line.id, "gstRateId", val)}>
                        <SelectTrigger><SelectValue placeholder="Tax %" /></SelectTrigger>
                        <SelectContent>
                          {taxRates.map((r) => (
                            <SelectItem key={r.taxRateId} value={String(r.taxRateId)}>{r.taxPercent}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 text-right px-2 pb-2">
                      <span className="text-xs font-semibold text-foreground">₹{total.net.toFixed(2)}</span>
                    </div>

                    <div className="pb-1">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-danger hover:bg-danger/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-semibold pt-4 border-t border-border/50">
            <div>Taxable: ₹{summary.taxable.toFixed(2)}</div>
            <div>GST: ₹{summary.tax.toFixed(2)} {isInterstate ? "(IGST)" : "(CGST + SGST)"}</div>
            <div className="text-sm font-bold text-foreground">Grand Total: ₹{summary.net.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Service description/maintenance notes" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : "Record Direct Bill"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Direct Bills</h1>
          <p className="text-sm text-muted-foreground">
            Manage non-trading purchases, services, and overhead expenses.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Direct Bill
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Taxable Amount</th>
              <th className="px-4 py-3 text-right">Net Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No direct bills recorded yet.
                </td>
              </tr>
            ) : (
              vouchers.map((v) => (
                <tr key={v.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{v.voucherNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {v.voucherDate ? new Date(v.voucherDate).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{v.supplierName || `Supplier ID ${v.partyId}`}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(v.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground font-bold">₹{Number(v.netAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{v.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
