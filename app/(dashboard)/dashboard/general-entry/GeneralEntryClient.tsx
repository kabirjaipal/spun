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
  partyCompany: string | null;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

interface JournalLine {
  id: string;
  ledgerId: string; // Stored as string containing ledgerId or raw text input
  entryType: "debit" | "credit";
  amount: string;
}

const EMPTY_LINE: JournalLine = { id: "", ledgerId: "", entryType: "debit", amount: "0" };

export default function GeneralEntryClient({
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
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Initialize with debit and credit lines when opening form
  const startCreation = () => {
    setLines([
      { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "debit" },
      { ...EMPTY_LINE, id: crypto.randomUUID(), entryType: "credit" },
    ]);
    setIsCreating(true);
  };

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

    // Resolve Ledger IDs from names
    const resolvedLines = lines.map((line) => {
      const matched = ledgers.find(
        (l) =>
          l.ledgerName.toLowerCase() === line.ledgerId.toLowerCase() ||
          String(l.ledgerId) === line.ledgerId
      );
      return {
        ...line,
        resolvedLedgerId: matched ? matched.ledgerId : null,
      };
    });

    const validLines = resolvedLines.filter((l) => l.resolvedLedgerId && Number(l.amount) > 0);
    if (validLines.length < 2) {
      setMessage("At least two valid postings with matching accounts are required.");
      return;
    }

    if (resolvedLines.some((l) => !l.resolvedLedgerId && l.ledgerId.trim() !== "")) {
      setMessage("Some accounts entered do not match existing ledgers. Please select from the autocomplete list.");
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
          ledgerId: line.resolvedLedgerId,
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
        throw new Error(json.error || "Failed to create general entry.");
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
        partyCompany: null,
      };

      setJournals([addedJournal, ...journals]);
      setMessage("General entry recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setRemarks("");
      setLines([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save general entry.");
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record General Entry</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Input adjustment entries between ledger accounts.</p>
            </div>
          </div>
          <Badge variant="secondary">General Entry</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="GE-001" />
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
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-4 lg:grid-cols-[1fr_2fr_1fr_auto] items-end border-b border-border/30 pb-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={line.entryType} onValueChange={(value: "debit" | "credit") => updateLine(line.id, "entryType", value)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">DEBIT</SelectItem>
                      <SelectItem value="credit">CREDIT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Ledger</Label>
                  <Input
                    placeholder="Search or type account..."
                    value={ledgers.find((l) => String(l.ledgerId) === line.ledgerId)?.ledgerName || line.ledgerId}
                    onChange={(e) => {
                      const typedValue = e.target.value;
                      const matched = ledgers.find((l) => l.ledgerName.toLowerCase() === typedValue.toLowerCase());
                      updateLine(line.id, "ledgerId", matched ? String(matched.ledgerId) : typedValue);
                    }}
                    list={`ledger-options-${line.id}`}
                    className="h-9"
                  />
                  <datalist id={`ledger-options-${line.id}`}>
                    {ledgers.map((l) => (
                      <option key={l.ledgerId} value={l.ledgerName}>
                        {l.ledgerType.toUpperCase()}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
                  <Input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => updateLine(line.id, "amount", e.target.value)} className="h-9" />
                </div>

                <div>
                  <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="text-danger hover:bg-danger/10 h-9 w-9">
                    <Trash2 className="h-4 w-4" />
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

        {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsCreating(false)} className="h-10 font-bold uppercase px-6">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate} className="h-10 font-bold uppercase px-6">
            {saving ? "Saving..." : "Record Entry"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">General Entries</h1>
          <p className="text-sm text-muted-foreground">
            Track adjustment and accrual entries with general ledger postings.
          </p>
        </div>
        {canCreate && (
          <Button onClick={startCreation} className="h-10 font-semibold uppercase">
            <Plus className="h-4 w-4 mr-1" /> Record General Entry
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {journals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground italic">
                    No entries have been recorded yet.
                  </td>
                </tr>
              ) : (
                journals.map((voucher) => (
                  <tr key={voucher.voucherId} className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-semibold text-foreground">{voucher.voucherNo}</td>
                    <td className="py-3 px-4">
                      {voucher.voucherDate ? new Date(voucher.voucherDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{voucher.remarks || "—"}</td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      ₹{Number(voucher.totalAmount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
