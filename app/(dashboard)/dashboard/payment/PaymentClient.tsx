"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ArrowLeft } from "lucide-react";

interface PaymentItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  remarks: string | null;
  supplierName: string | null;
  customerName: string | null;
}

interface SupplierOption {
  supplierId: number;
  supplierName: string;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

export default function PaymentClient({
  initialPayments,
  suppliers,
  cashBankLedgers,
  canCreate,
}: {
  initialPayments: PaymentItem[];
  suppliers: SupplierOption[];
  cashBankLedgers: LedgerOption[];
  canCreate: boolean;
}) {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [amount, setAmount] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!canCreate) return;
    if (!voucherNo || !selectedSupplier || !selectedLedger || Number(amount) <= 0) {
      setMessage("Please fill in all fields and ensure amount is greater than 0.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "payment",
        voucherNo,
        voucherDate,
        partyId: Number(selectedSupplier),
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
        throw new Error(json.error || "Failed to create payment voucher.");
      }

      const newVoucher = await response.json();

      // Find supplier name for display
      const suppObj = suppliers.find((s) => String(s.supplierId) === selectedSupplier);

      const addedPayment: PaymentItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        remarks: newVoucher.remarks,
        supplierName: suppObj ? suppObj.supplierName : `ID ${newVoucher.partyId}`,
        customerName: null,
      };

      setPayments([addedPayment, ...payments]);
      setMessage("Payment voucher recorded successfully.");
      setIsCreating(false);

      // Reset form
      setVoucherNo("");
      setSelectedSupplier("");
      setSelectedLedger("");
      setAmount("0");
      setRemarks("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save payment.");
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Payment Voucher</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Credit cash/bank and debit supplier ledger.</p>
            </div>
          </div>
          <Badge variant="secondary">Payment</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="PAY-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cash / Bank Account (Credit)</Label>
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
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Supplier (Debit)</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
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
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Payment sent against purchase invoice" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : "Record Payment"}
          </Button>
        </div>
      </div>
    );
  }

  const totalPayments = payments.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Vouchers</h1>
          <p className="text-sm text-muted-foreground">
            Review cash and supplier payment entries recorded in your company.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent Payments</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{payments.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalPayments.toFixed(2)}</p>
        </div>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No payment vouchers recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const partyName = payment.supplierName || payment.customerName || `ID ${payment.partyId}`;
                return (
                  <tr key={payment.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{payment.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payment.voucherDate ? new Date(payment.voucherDate).toISOString().slice(0, 10) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-right text-foreground">₹{Number(payment.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{payment.remarks || "—"}</td>
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
