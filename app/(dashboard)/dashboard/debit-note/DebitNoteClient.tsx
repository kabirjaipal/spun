"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft, Trash2 } from "lucide-react";
import PieceMetersDialog from "@/components/PieceMetersDialog";

interface DebitNoteItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  netAmount: string;
  remarks: string | null;
  companyName: string | null;
}

interface CompanyOption {
  companyId: number;
  companyName: string;
  address: string | null;
  gstNo: string | null;
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

interface PurchaseInvoiceOption {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: string;
}

interface LineItem {
  id: string;
  ledgerId: string;
  hsnCode: string;
  pcs: string;
  quantity: string;
  unitType: "pcs" | "mtr";
  fold: string;
  rate: string;
  gstRateId: string;
  pieceMeters?: string[];
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  ledgerId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  unitType: "mtr",
  fold: "100",
  rate: "0",
  gstRateId: "",
  pieceMeters: [],
});

export default function DebitNoteClient({
  initialNotes,
  company,
  companies,
  inventory,
  ledgers,
  taxRates,
  canCreate,
}: {
  initialNotes: DebitNoteItem[];
  company: { companyName: string; gstNo?: string | null; address?: string | null; state?: string | null };
  companies: CompanyOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [notes, setNotes] = useState<DebitNoteItem[]>(initialNotes);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activePieceLineId, setActivePieceLineId] = useState<string | null>(null);

  function handleSavePieceMeters(meters: string[]) {
    if (!activePieceLineId) return;
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== activePieceLineId) return item;
        let pcs = 0;
        let totalQty = 0;
        for (const m of meters) {
          if (m.includes("x")) {
            const [pStr, qStr] = m.split("x");
            const p = parseInt(pStr) || 0;
            const q = parseFloat(qStr) || 0;
            pcs += p;
            totalQty += p * q;
          } else {
            pcs += 1;
            totalQty += parseFloat(m) || 0;
          }
        }
        return {
          ...item,
          pcs: String(pcs),
          quantity: totalQty > 0 ? String(parseFloat(totalQty.toFixed(2))) : item.quantity,
          pieceMeters: meters,
        };
      })
    );
    setActivePieceLineId(null);
  }

  // Fetch purchase invoices for selected company
  const [invoices, setInvoices] = useState<PurchaseInvoiceOption[]>([]);

  useEffect(() => {
    if (!selectedCompany) {
      setInvoices([]);
      setSelectedInvoice("");
      return;
    }
    fetch(`/api/vouchers?type=purchase&partyId=${selectedCompany}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInvoices(data);
        }
      })
      .catch((err) => console.error("Error fetching purchase invoices:", err));
  }, [selectedCompany]);

  const purchaseReturnLedgers = useMemo(() => {
    return ledgers.filter(
      (l) => l.ledgerType === "purchase" || l.ledgerType === "expense" || l.ledgerType === "other"
    );
  }, [ledgers]);

  const eligibleLedgers = useMemo(() => {
    return ledgers.filter((l) => l.ledgerType !== "company");
  }, [ledgers]);

  const suppObj = useMemo(() => {
    return companies.find((s) => String(s.companyId) === selectedCompany);
  }, [selectedCompany, companies]);

  const isInterstate = useMemo(() => {
    if (company?.state && suppObj?.state) {
      return company.state.trim().toLowerCase() !== suppObj.state.trim().toLowerCase();
    }
    if (!company.gstNo || !suppObj?.gstNo) return false;
    return company.gstNo.slice(0, 2) !== suppObj.gstNo.slice(0, 2);
  }, [company.gstNo, company.state, suppObj]);

  const lineTotals = useMemo(() => {
    return lineItems.map((item) => {
      const pcs = Number(item.pcs) || 0;
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const fold = Number(item.fold) || 100;

      const unitVal = item.unitType === "pcs" ? pcs : qty;
      const taxable = Math.round((unitVal * rate * (fold / 100)) * 100) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (item.gstRateId) {
        const rateObj = taxRates.find((r) => String(r.taxRateId) === item.gstRateId);
        if (rateObj) {
          const taxPercent = Number(rateObj.taxPercent || 0);
          const totalTax = Math.round(((taxable * taxPercent) / 100) * 100) / 100;
          if (isInterstate) {
            igst = totalTax;
          } else {
            cgst = Math.round((totalTax / 2) * 100) / 100;
            sgst = Math.round((totalTax - cgst) * 100) / 100;
          }
        }
      }

      return {
        taxable,
        cgst,
        sgst,
        igst,
        net: taxable + cgst + sgst + igst,
      };
    });
  }, [lineItems, taxRates, isInterstate]);

  const summary = useMemo(() => {
    return lineTotals.reduce(
      (acc, curr) => ({
        taxable: acc.taxable + curr.taxable,
        tax: acc.tax + (curr.cgst + curr.sgst + curr.igst),
        net: acc.net + curr.net,
      }),
      { taxable: 0, tax: 0, net: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
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

    const validLines = lineItems.filter((l) => l.ledgerId && (Number(l.pcs) > 0 || Number(l.quantity) > 0));
    if (!selectedCompany || !voucherNo || validLines.length === 0) {
      setMessage("Please select company, enter voucher number, and add at least one valid line with Account Head and quantity/pcs.");
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
        partyId: Number(selectedCompany),
        remarks: invoiceVoucher ? `[AGAINST PURCHASE BILL ${invoiceVoucher.voucherNo}] ${remarks}` : remarks,
        parentVoucherId: selectedInvoice ? Number(selectedInvoice) : null,
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode,
            pcs: Number(line.pcs),
            quantity: Number(line.quantity),
            jobRateType: line.unitType,
            fold: Number(line.fold),
            rate: Number(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals ? totals.cgst : 0,
            sgst: totals ? totals.sgst : 0,
            igst: totals ? totals.igst : 0,
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
        companyName: suppObj ? suppObj.companyName : `ID ${newVoucher.partyId}`,
      };

      setNotes([added, ...notes]);
      setMessage("Debit note recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setSelectedCompany("");
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
    const gridColsClass = isInterstate
      ? "md:grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.8fr_0.8fr_1fr_auto]"
      : "md:grid-cols-[2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_0.8fr_0.8fr_0.8fr_1fr_auto]";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Debit Note</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Input purchase return adjustments or debits against company accounts.</p>
            </div>
          </div>
          <Badge variant="secondary">Debit Note</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <Label >Company (Party)</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Debit Note No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="DRN-001" />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Against Purchase Invoice</Label>
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
                  <div
                    key={line.id}
                    className={`grid gap-2 grid-cols-1 ${gridColsClass} items-end border-b border-border/20 pb-3`}
                  >
                    <div className="space-y-2">
                      <Label >Account Head</Label>
                      <Select value={line.ledgerId} onValueChange={(val) => updateLine(line.id, "ledgerId", val)}>
                        <SelectTrigger><SelectValue placeholder="Account Head" /></SelectTrigger>
                        <SelectContent>
                          {eligibleLedgers.map((l) => (
                            <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>{l.ledgerName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label >PCS</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={line.pcs}
                          onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                          readOnly={!!(line.pieceMeters && line.pieceMeters.length > 0)}
                          className={line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => setActivePieceLineId(line.id)}
                          title="Enter Piece Meters"
                        >
                          ⚙️
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label >Qty / Mtr</Label>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        readOnly={!!(line.pieceMeters && line.pieceMeters.length > 0)}
                        className={line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label >Unit</Label>
                      <Select value={line.unitType} onValueChange={(val) => updateLine(line.id, "unitType", val as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mtr">Mtr</SelectItem>
                          <SelectItem value="pcs">Pcs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label >Rate</Label>
                      <Input type="number" value={line.rate} onChange={(e) => updateLine(line.id, "rate", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label >Taxable Amt</Label>
                      <Input type="number" value={total.taxable.toFixed(2)} disabled className="text-right" />
                    </div>

                    <div className="space-y-2">
                      <Label >Tax Rate</Label>
                      <Select value={line.gstRateId} onValueChange={(val) => updateLine(line.id, "gstRateId", val)}>
                        <SelectTrigger><SelectValue placeholder="Tax %" /></SelectTrigger>
                        <SelectContent>
                          {taxRates.map((r) => (
                            <SelectItem key={r.taxRateId} value={String(r.taxRateId)}>{r.taxPercent}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {isInterstate ? (
                      <div className="space-y-2">
                        <Label >IGST</Label>
                        <Input type="number" value={total.igst.toFixed(2)} disabled className="text-right" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label >CGST</Label>
                          <Input type="number" value={total.cgst.toFixed(2)} disabled className="text-right" />
                        </div>
                        <div className="space-y-2">
                          <Label >SGST</Label>
                          <Input type="number" value={total.sgst.toFixed(2)} disabled className="text-right" />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label >Net Amt</Label>
                      <Input type="number" value={total.net.toFixed(2)} disabled className="text-right" />
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
            <Label>Remarks</Label>
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
        {activePieceLineId && (() => {
          const activeLine = lineItems.find((l) => l.id === activePieceLineId);
          return (
            <PieceMetersDialog
              isOpen={!!activePieceLineId}
              onClose={() => setActivePieceLineId(null)}
              pcsCount={Number(activeLine?.pcs) || 0}
              quantityCount={Number(activeLine?.quantity) || 0}
              initialMeters={activeLine?.pieceMeters || []}
              onSave={handleSavePieceMeters}
            />
          );
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Debit Notes</h1>
          <p className="text-sm text-muted-foreground">
            Manage company purchase returns and account adjustments.
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
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Company Name</th>
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
                  <td className="px-4 py-3 text-foreground">{n.companyName || `Company ID ${n.partyId}`}</td>
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
