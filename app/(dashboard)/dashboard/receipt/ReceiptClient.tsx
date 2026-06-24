"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft } from "lucide-react";

interface ReceiptItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  remarks: string | null;
  customerName: string | null;
}

interface CustomerOption {
  customerId: number;
  customerName: string;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

export default function ReceiptClient({
  initialReceipts,
  customers,
  cashBankLedgers,
  canCreate,
}: {
  initialReceipts: ReceiptItem[];
  customers: CustomerOption[];
  cashBankLedgers: LedgerOption[];
  canCreate: boolean;
}) {
  const [receipts, setReceipts] = useState<ReceiptItem[]>(initialReceipts);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [amount, setAmount] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!canCreate) return;
    if (!voucherNo || !selectedCustomer || !selectedLedger || Number(amount) <= 0) {
      setMessage("Please fill in all fields and ensure amount is greater than 0.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "receipt",
        voucherNo,
        voucherDate,
        partyId: Number(selectedCustomer),
        cashBankLedgerId: Number(selectedLedger),
        totalAmount: Number(amount),
        remarks,
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to create receipt voucher.");
      }

      const newVoucher = await response.json();

      // Find customer name for display
      const custObj = customers.find((c) => String(c.customerId) === selectedCustomer);

      const addedReceipt: ReceiptItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        remarks: newVoucher.remarks,
        customerName: custObj ? custObj.customerName : `ID ${newVoucher.partyId}`,
      };

      setReceipts([addedReceipt, ...receipts]);
      setMessage("Receipt voucher recorded successfully.");
      setIsCreating(false);
      
      // Reset form fields
      setVoucherNo("");
      setSelectedCustomer("");
      setSelectedLedger("");
      setAmount("0");
      setRemarks("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save receipt.");
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Receipt Voucher</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Debit cash/bank and credit customer ledger.</p>
            </div>
          </div>
          <Badge variant="secondary">Receipt</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="RCPT-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash / Bank Account (Debit)</Label>
              <Select value={selectedLedger} onValueChange={setSelectedLedger}>
                <SelectTrigger><SelectValue placeholder="Select ledger" /></SelectTrigger>
                <SelectContent>
                  {cashBankLedgers.map((l) => (
                    <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>
                      {l.ledgerName} ({l.ledgerType.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer (Credit)</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger><SelectValue placeholder="Choose customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.customerId} value={String(c.customerId)}>
                      {c.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Payment received against invoice" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : "Record Receipt"}
          </Button>
        </div>
      </div>
    );
  }

  const totalAmount = receipts.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Receipt Vouchers</h1>
          <p className="text-sm text-muted-foreground">
            Review receipts from customers and advances collected into your account.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Receipt
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Receipts recorded</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{receipts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Latest receipt</p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {receipts[0]?.voucherNo ?? "None"}
          </p>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No receipt vouchers found.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{receipt.voucherNo}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {receipt.voucherDate ? new Date(receipt.voucherDate).toISOString().slice(0, 10) : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{receipt.customerName || `ID ${receipt.partyId}`}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{Number(receipt.totalAmount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate">{receipt.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
