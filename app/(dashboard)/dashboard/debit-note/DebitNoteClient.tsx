"use client";
import { getLocalTodayString } from "@/lib/utils";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft, Trash2, Pencil } from "lucide-react";

interface DebitNoteItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  netAmount: string;
  remarks: string | null;
  companyName: string | null;
  parentVoucherId?: number | null;
  tdsSection?: string | null;
  tdsRate?: string | null;
  tdsAmount?: string | null;
  lineItems?: LineItem[];
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

interface InvoiceOption {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  netAmount: string;
}

interface LineItem {
  id: string;
  ledgerId: string;
  hsnCode: string;
  taxableAmount: string;
  gstRateId: string;
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  ledgerId: "",
  hsnCode: "",
  taxableAmount: "0",
  gstRateId: "",
});

export default function DebitNoteClient({
  initialNotes,
  company,
  companies,
  inventory,
  ledgers,
  taxRates,
  canCreate,
  canUpdate,
  canDelete,
  customTdsSections,
  initialEditVoucher,
}: {
  initialNotes: DebitNoteItem[];
  company: { companyName: string; gstNo?: string | null; address?: string | null; state?: string | null };
  companies: CompanyOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  customTdsSections?: string[];
  initialEditVoucher?: any;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<DebitNoteItem[]>(initialNotes);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<DebitNoteItem | null>(null);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(getLocalTodayString());
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Custom TDS section state
  const [customInputTdsSection, setCustomInputTdsSection] = useState("");

  const resetForm = () => {
    setEditingNote(null);
    setSelectedCompany("");
    setSelectedInvoice("");
    setRemarks("");
    setTdsSection("None");
    setCustomInputTdsSection("");
    setTdsRate("0");
    setLineItems([EMPTY_LINE()]);
    fetchNextVoucherNo();
    if (editingNote || initialEditVoucher) {
      router.push("/dashboard/debit-note");
    }
  };

  const handleEdit = (note: DebitNoteItem) => {
    setEditingNote(note);
    setVoucherNo(note.voucherNo);
    setVoucherDate(note.voucherDate ? new Date(note.voucherDate).toISOString().slice(0, 10) : getLocalTodayString());
    setSelectedCompany(note.partyId ? String(note.partyId) : "");
    setSelectedInvoice(note.parentVoucherId ? String(note.parentVoucherId) : "");

    const rawRemarks = note.remarks || "";
    const bracketIndex = rawRemarks.indexOf("]");
    if (rawRemarks.startsWith("[AGAINST BILL ") && bracketIndex !== -1) {
      setRemarks(rawRemarks.slice(bracketIndex + 1).trim());
    } else {
      setRemarks(rawRemarks);
    }

    const defaultSecs = ["None", "194C", "194H", "194I", "194J", "194Q", "195"];
    if (note.tdsSection) {
      if (defaultSecs.includes(note.tdsSection) || (customTdsSections && customTdsSections.includes(note.tdsSection))) {
        setTdsSection(note.tdsSection);
        setCustomInputTdsSection("");
      } else {
        setTdsSection("Other");
        setCustomInputTdsSection(note.tdsSection);
      }
    } else {
      setTdsSection("None");
      setCustomInputTdsSection("");
    }
    setTdsRate(note.tdsRate ? String(Number(note.tdsRate)) : "0");

    if (note.lineItems && note.lineItems.length > 0) {
      setLineItems(note.lineItems);
    } else {
      setLineItems([EMPTY_LINE()]);
    }
    setIsCreating(true);
  };

  const handleDelete = async (note: DebitNoteItem) => {
    if (!confirm("Are you sure you want to delete this debit note?")) return;
    try {
      const res = await fetch(`/api/vouchers/${note.voucherId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete debit note");
      }
      setNotes(notes.filter((n) => n.voucherId !== note.voucherId));
      setMessage("Debit note deleted successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error deleting debit note.");
    }
  };

  // Fetch invoices for selected company
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [tdsSection, setTdsSection] = useState("None");
  const [tdsRate, setTdsRate] = useState("0");
  const [outstandingBills, setOutstandingBills] = useState<any[]>([]);

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=debit_note");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next debit note voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  useEffect(() => {
    if (initialEditVoucher) {
      handleEdit(initialEditVoucher);
    }
  }, [initialEditVoucher]);



  const handleTdsSectionChange = (section: string) => {
    setTdsSection(section);
    if (section === "194C") {
      setTdsRate("2");
    } else if (section === "194J") {
      setTdsRate("10");
    } else if (section === "194I") {
      setTdsRate("10");
    } else if (section === "194H") {
      setTdsRate("5");
    } else if (section === "194Q") {
      setTdsRate("0.1");
    } else if (section === "195") {
      setTdsRate("10");
    } else {
      setTdsRate("0");
    }
  };

  useEffect(() => {
    if (!selectedCompany) {
      setInvoices([]);
      setSelectedInvoice("");
      return;
    }
    fetch(`/api/vouchers?type=all_bills&partyId=${selectedCompany}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setInvoices(data);
        }
      })
      .catch((err) => console.error("Error fetching invoices:", err));
  }, [selectedCompany]);

  const purchaseReturnLedgers = useMemo(() => {
    return ledgers.filter(
      (l) => l.ledgerType === "purchase" || l.ledgerType === "expense" || l.ledgerType === "other"
    );
  }, [ledgers]);

  const eligibleLedgers = useMemo(() => {
    return ledgers;
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
      const taxable = Number(item.taxableAmount) || 0;

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

  const tdsAmount = useMemo(() => {
    if (tdsSection === "None") return 0;
    const rate = Number(tdsRate) || 0;
    return Math.round(((summary.net * rate) / 100) * 100) / 100;
  }, [summary.net, tdsRate, tdsSection]);

  const finalNetAmount = useMemo(() => {
    return Math.round((summary.net - tdsAmount) * 100) / 100;
  }, [summary.net, tdsAmount]);

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
    if (!canCreate && !editingNote) return;

    const validLines = lineItems.filter((l) => l.ledgerId && Number(l.taxableAmount) > 0);
    if (!selectedCompany || !voucherNo || validLines.length === 0) {
      setMessage("Please select company, enter voucher number, and add at least one valid line with Account Head and Taxable Amount.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const invoiceVoucher = invoices.find((inv) => String(inv.voucherId) === selectedInvoice);

    try {
      const finalTdsSection = tdsSection === "Other" ? customInputTdsSection : (tdsSection !== "None" ? tdsSection : null);
      const body = {
        voucherType: "debit_note",
        voucherNo,
        voucherDate,
        partyId: Number(selectedCompany),
        remarks: invoiceVoucher ? `[AGAINST BILL ${invoiceVoucher.voucherNo}] ${remarks}` : remarks,
        parentVoucherId: selectedInvoice ? Number(selectedInvoice) : null,
        tdsSection: finalTdsSection,
        tdsRate: tdsSection !== "None" ? Number(tdsRate) : 0,
        tdsAmount: tdsSection !== "None" ? tdsAmount : 0,
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode,
            pcs: 0,
            quantity: 0,
            jobRateType: "mtr",
            fold: 100,
            rate: 0,
            taxableAmount: Number(line.taxableAmount),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals ? totals.cgst : 0,
            sgst: totals ? totals.sgst : 0,
            igst: totals ? totals.igst : 0,
            pieceMeters: [],
          };
        }),
      };

      const url = editingNote ? `/api/vouchers/${editingNote.voucherId}` : "/api/vouchers";
      const method = editingNote ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || `Failed to ${editingNote ? "update" : "save"} debit note.`);
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
        parentVoucherId: newVoucher.parentVoucherId,
        tdsSection: newVoucher.tdsSection,
        tdsRate: newVoucher.tdsRate,
        tdsAmount: newVoucher.tdsAmount,
        lineItems: validLines,
      };

      if (editingNote) {
        setNotes(notes.map((n) => n.voucherId === editingNote.voucherId ? added : n));
        setMessage("Debit note updated successfully.");
      } else {
        setNotes([added, ...notes]);
        setMessage("Debit note recorded successfully.");
      }
      setIsCreating(false);
      resetForm();
      setTdsSection("None");
      setTdsRate("0");
      setLineItems([EMPTY_LINE()]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error saving debit note.");
    } finally {
      setSaving(false);
    }
  }

  if (isCreating) {
    const gridColsClass = "md:grid-cols-[2.5fr_1.2fr_1.2fr_1fr_1fr_1fr_1.2fr_auto]";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">{editingNote ? "Edit Debit Note" : "Record Debit Note"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Debit vendor account ledger and post returns/adjustments.</p>
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
              <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-10" />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Against Invoice</Label>
              <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Choose Invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.voucherId} value={String(inv.voucherId)}>
                      {inv.voucherNo} ({inv.voucherType === "sale" ? "Sales" : "Purchase"}) (₹{Number(inv.netAmount).toFixed(2)})
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
                      <Label >Taxable Amt</Label>
                      <Input
                        type="number"
                        value={line.taxableAmount}
                        onChange={(e) => updateLine(line.id, "taxableAmount", e.target.value)}
                        className="text-right"
                      />
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

                    <div className="space-y-2">
                      <Label >CGST</Label>
                      <Input type="number" value={total.cgst.toFixed(2)} disabled className="text-right bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label >SGST</Label>
                      <Input type="number" value={total.sgst.toFixed(2)} disabled className="text-right bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label >IGST</Label>
                      <Input type="number" value={total.igst.toFixed(2)} disabled className="text-right bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label >Net Amt</Label>
                      <Input type="number" value={total.net.toFixed(2)} disabled className="text-right bg-muted" />
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

          {/* TDS Section fields */}
          <div className="grid gap-4 md:grid-cols-4 border-t border-border/50 pt-4 pb-2">
            <div className="space-y-2">
              <Label>TDS Undersection</Label>
              <Select value={tdsSection} onValueChange={handleTdsSectionChange}>
                <SelectTrigger><SelectValue placeholder="TDS Section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="194C">194C (Contractors)</SelectItem>
                  <SelectItem value="194H">194H (Commission)</SelectItem>
                  <SelectItem value="194I">194I (Rent)</SelectItem>
                  <SelectItem value="194J">194J (Professional/Technical)</SelectItem>
                  <SelectItem value="194Q">194Q (Purchase of goods)</SelectItem>
                  <SelectItem value="195">195 (Non-residents)</SelectItem>
                  {customTdsSections && customTdsSections.map((sec) => (
                    !["None", "194C", "194H", "194I", "194J", "194Q", "195"].includes(sec) && (
                      <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                    )
                  ))}
                  <SelectItem value="Other">Other Section</SelectItem>
                </SelectContent>
              </Select>
              {tdsSection === "Other" && (
                <Input
                  className="mt-2"
                  value={customInputTdsSection}
                  onChange={(e) => setCustomInputTdsSection(e.target.value)}
                  placeholder="Type Custom TDS Section (e.g. 194IA)"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>TDS Percentage (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={tdsRate}
                onChange={(e) => setTdsRate(e.target.value)}
                disabled={tdsSection === "None"}
                placeholder="Rate %"
              />
            </div>

            <div className="space-y-2">
              <Label>TDS Amount</Label>
              <Input
                type="number"
                value={tdsAmount.toFixed(2)}
                disabled
                className="bg-muted text-right font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Net Amount</Label>
              <Input
                type="number"
                value={finalNetAmount.toFixed(2)}
                disabled
                className="bg-muted text-right font-semibold font-mono"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-semibold pt-4 border-t border-border/50">
            <div>Taxable: ₹{summary.taxable.toFixed(2)}</div>
            <div>GST: ₹{summary.tax.toFixed(2)} {isInterstate ? "(IGST)" : "(CGST + SGST)"}</div>
            <div>TDS Deducted: ₹{tdsAmount.toFixed(2)}</div>
            <div className="text-sm font-bold text-foreground">Net Grand Total: ₹{finalNetAmount.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Purchase return reason / rate adjustment details" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setIsCreating(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || (!canCreate && !editingNote)}>
            {saving ? (
              <>
                <Spinner className="mr-2" />
                Saving
              </>
            ) : (
              editingNote ? "Update Debit Note" : "Record Debit Note"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Debit Notes</h1>
        </div>
        {canCreate && (
          <Button onClick={() => { setIsCreating(true); setEditingNote(null); }} className="flex items-center gap-2">
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
              {(canUpdate || canDelete) && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={(canUpdate || canDelete) ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                  <td className="px-4 py-3 text-right text-foreground font-mono">₹{Number(n.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-foreground font-bold font-mono">₹{Number(n.netAmount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{n.remarks || "—"}</td>
                  {(canUpdate || canDelete) && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(n)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(n)} className="text-danger hover:bg-danger/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
