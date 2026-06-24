"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft, Trash2 } from "lucide-react";

interface JournalItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  remarks: string | null;
  totalAmount: string;
  partyCustomer: string | null;
  partySupplier: string | null;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

interface JournalLine {
  id: string;
  ledgerId: string;
  entryType: "debit" | "credit";
  amount: string;
}

const EMPTY_LINE: JournalLine = { id: "", ledgerId: "", entryType: "debit", amount: "0" };

export default function JournalClient({
  initialJournals,
  ledgers,
  canCreate,
}: {
  initialJournals: JournalItem[];
  ledgers: LedgerOption[];
  canCreate: boolean;
}) {
  const [journals, setJournals] = useState<JournalItem[]>(initialJournals);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "debit" },
    { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "credit" },
  ]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const debitTotal = useMemo(() => {
    return lines.filter(l => l.entryType === "debit").reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [lines]);

  const creditTotal = useMemo(() => {
    return lines.filter(l => l.entryType === "credit").reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [lines]);

  const isBalanced = useMemo(() => {
    return Math.abs(debitTotal - creditTotal) < 0.01 && debitTotal > 0;
  }, [debitTotal, creditTotal]);

  function updateLine(id: string, field: keyof JournalLine, value: string) {
    setLines(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function addLine() {
    setLines(items => [...items, { ...EMPTY_LINE, id: crypto.randomUUID() }]);
  }

  function removeLine(id: string) {
    setLines(items => items.filter(item => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!voucherNo) {
      setMessage("Voucher number is required.");
      return;
    }

    const validLines = lines.filter(l => l.ledgerId && Number(l.amount) > 0);
    if (validLines.length < 2) {
      setMessage("At least two valid transaction lines are required.");
      return;
    }

    if (!isBalanced) {
      setMessage(`Debits (₹${debitTotal.toFixed(2)}) and Credits (₹${creditTotal.toFixed(2)}) must balance exactly.`);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "journal",
        voucherNo,
        voucherDate,
        remarks,
        lineItems: validLines.map((line) => ({
          ledgerId: Number(line.ledgerId),
          entryType: line.entryType,
          amount: Number(line.amount),
        })),
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to create journal voucher.");
      }

      const newVoucher = await response.json();

      const addedJournal: JournalItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: null,
        remarks: newVoucher.remarks,
        totalAmount: String(newVoucher.totalAmount),
        partyCustomer: null,
        partySupplier: null,
      };

      setJournals([addedJournal, ...journals]);
      setMessage("Journal voucher recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setRemarks("");
      setLines([
        { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "debit" },
        { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "credit" },
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save journal.");
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Journal Voucher</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Input adjustment entries between ledger accounts.</p>
            </div>
          </div>
          <Badge variant="secondary">Journal</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="JV-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Year-end adjustment / depreciation" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground font-sans">Ledger Postings</h2>
              <p className="text-xs text-muted-foreground">Add debit and credit accounts.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add Account
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-4 lg:grid-cols-[1fr_2fr_1fr_auto] items-end border-b border-border/30 pb-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={line.entryType} onValueChange={(value: "debit" | "credit") => updateLine(line.id, "entryType", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">DEBIT</SelectItem>
                      <SelectItem value="credit">CREDIT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Ledger</Label>
                  <Select value={line.ledgerId} onValueChange={(value) => updateLine(line.id, "ledgerId", value)}>
                    <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                    <SelectContent>
                      {ledgers.map((l) => (
                        <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>
                          {l.ledgerName} ({l.ledgerType.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => updateLine(line.id, "amount", e.target.value)} />
                </div>

                <div>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeLine(line.id)} className="text-danger hover:bg-danger/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-xs font-semibold pt-2 border-t border-border/50">
            <div>
              Total Debits: <span className="text-foreground">₹{debitTotal.toFixed(2)}</span>
            </div>
            <div>
              Total Credits: <span className="text-foreground">₹{creditTotal.toFixed(2)}</span>
            </div>
            <div>
              Status:{" "}
              {isBalanced ? (
                <span className="text-success uppercase font-bold">Balanced</span>
              ) : (
                <span className="text-danger uppercase font-bold">Unbalanced</span>
              )}
            </div>
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !isBalanced || !canCreate}>
            {saving ? "Saving..." : "Record Journal"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Vouchers</h1>
          <p className="text-sm text-muted-foreground">
            Track adjustment and accrual entries with journal vouchers.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Journal
          </Button>
        )}
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Party (Associated)</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {journals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No journal vouchers have been recorded yet.
                </td>
              </tr>
            ) : (
              journals.map((voucher) => {
                const partyName = voucher.partyCustomer || voucher.partySupplier || "General JV";
                return (
                  <tr key={voucher.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{voucher.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground font-sans">
                      {voucher.voucherDate ? new Date(voucher.voucherDate).toISOString().slice(0, 10) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(voucher.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{voucher.remarks || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
