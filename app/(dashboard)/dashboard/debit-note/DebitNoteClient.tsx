"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft, Trash2 } from "lucide-react";

interface DebitNoteItem {
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

interface PurchaseInvoiceOption {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: string;
}

interface LineItem {
  id: string;
  inventoryId: string;
  ledgerId: string; // Purchase return / expense ledger
  hsnCode: string;
  pcs: string;
  quantity: string;
  fold: string;
  rate: string;
  gstRateId: string;
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  inventoryId: "",
  ledgerId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  fold: "100",
  rate: "0",
  gstRateId: "",
});

export default function DebitNoteClient({
  initialNotes,
  company,
  suppliers,
  inventory,
  ledgers,
  taxRates,
  canCreate,
}: {
  initialNotes: DebitNoteItem[];
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  suppliers: SupplierOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [notes, setNotes] = useState<DebitNoteItem[]>(initialNotes);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch purchase invoices for selected supplier
  const [invoices, setInvoices] = useState<PurchaseInvoiceOption[]>([]);

  useEffect(() => {
    if (!selectedSupplier) {
      setInvoices([]);
      setSelectedInvoice("");
      return;
    }
    fetch(`/api/vouchers?type=purchase&partyId=${selectedSupplier}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInvoices(data);
        }
      })
      .catch((err) => console.error("Error fetching purchase invoices:", err));
  }, [selectedSupplier]);

  const purchaseReturnLedgers = useMemo(() => {
    return ledgers.filter(
      (l) => l.ledgerType === "purchase" || l.ledgerType === "expense" || l.ledgerType === "other"
    );
  }, [ledgers]);

  const suppObj = useMemo(() => {
    return suppliers.find((s) => String(s.supplierId) === selectedSupplier);
  }, [selectedSupplier, suppliers]);

  const isInterstate = useMemo(() => {
    if (!company.gstNo || !suppObj?.gstNo) return false;
    return company.gstNo.slice(0, 2) !== suppObj.gstNo.slice(0, 2);
  }, [company.gstNo, suppObj]);

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

        if (field === "inventoryId") {
          const prod = inventory.find((p) => String(p.inventoryId) === value);
          return {
            ...item,
            inventoryId: value,
            hsnCode: prod?.inventoryCode || "",
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
      setMessage("Please select supplier and enter voucher number.");
      return;
    }

    const validLines = lineItems.filter((l) => l.inventoryId && l.ledgerId && Number(l.quantity) > 0);
    if (validLines.length === 0) {
      setMessage("At least one valid line with item, ledger, and quantity is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const invoiceVoucher = invoices.find((inv) => String(inv.voucherId) === selectedInvoice);

    try {
      const body = {
        voucherType: "debit_note",
        voucherNo,
        voucherDate,
        partyId: Number(selectedSupplier),
        remarks: invoiceVoucher ? `[AGAINST PURCHASE BILL ${invoiceVoucher.voucherNo}] ${remarks}` : remarks,
        parentVoucherId: selectedInvoice ? Number(selectedInvoice) : null,
        lineItems: validLines.map((line) => ({
          inventoryId: Number(line.inventoryId),
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
        throw new Error(json.error || "Failed to save debit note.");
      }

      const newVoucher = await response.json();

      const added: DebitNoteItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        netAmount: String(newVoucher.netAmount),
        remarks: newVoucher.remarks,
        supplierName: suppObj ? suppObj.supplierName : `ID ${newVoucher.partyId}`,
      };

      setNotes([added, ...notes]);
      setMessage("Debit note voucher recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setSelectedSupplier("");
      setSelectedInvoice("");
      setRemarks("");
      setLineItems([EMPTY_LINE()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error saving debit note.");
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Debit Note</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Input purchase return adjustments or debits against supplier accounts.</p>
            </div>
          </div>
          <Badge variant="secondary">Debit Note</Badge>
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
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Debit Note No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="DRN-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Against Purchase Invoice</Label>
              <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                <SelectTrigger><SelectValue placeholder="Select Purchase Bill" /></SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.voucherId} value={String(inv.voucherId)}>
                      {inv.voucherNo} (₹{Number(inv.netAmount).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Items / Details</h3>
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
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Item</Label>
                      <Select value={line.inventoryId} onValueChange={(val) => updateLine(line.id, "inventoryId", val)}>
                        <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                        <SelectContent>
                          {inventory.map((p) => (
                            <SelectItem key={p.inventoryId} value={String(p.inventoryId)}>{p.inventoryName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Purchase Return Ledger</Label>
                      <Select value={line.ledgerId} onValueChange={(val) => updateLine(line.id, "ledgerId", val)}>
                        <SelectTrigger><SelectValue placeholder="Select Ledger" /></SelectTrigger>
                        <SelectContent>
                          {purchaseReturnLedgers.map((l) => (
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
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Purchase return reason / rate adjustment details" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : "Record Debit Note"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Debit Notes</h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier purchase returns and account adjustments.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Debit Note
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Note No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Taxable Amount</th>
              <th className="px-4 py-3 text-right">Net Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No debit notes recorded yet.
                </td>
              </tr>
            ) : (
              notes.map((n) => (
                <tr key={n.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{n.voucherNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {n.voucherDate ? new Date(n.voucherDate).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{n.supplierName || `Supplier ID ${n.partyId}`}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(n.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground font-bold">₹{Number(n.netAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{n.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
