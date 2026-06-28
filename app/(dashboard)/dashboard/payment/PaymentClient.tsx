"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";

interface PaymentItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  remarks: string | null;
  companyName: string | null;
  customerName: string | null;
  lrNo?: string | null; // Cheque / Ref No
}

interface CompanyOption {
  companyId: number;
  companyName: string;
}

interface LedgerOption {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
}

interface OutstandingBill {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: number;
  paidAmount: number;
  outstanding: number;
  rateOfInterest: number;
  creditDays: number;
}

interface BillAdjustment {
  amount: string;
  days: number;
  interest: number;
}

export default function PaymentClient({
  initialPayments,
  companies,
  cashBankLedgers,
  canCreate,
}: {
  initialPayments: PaymentItem[];
  companies: CompanyOption[];
  cashBankLedgers: LedgerOption[];
  canCreate: boolean;
}) {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [amount, setAmount] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [isReversal, setIsReversal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Bill adjustments states
  const [outstandingBills, setOutstandingBills] = useState<OutstandingBill[]>([]);
  const [billAdjustments, setBillAdjustments] = useState<Record<number, BillAdjustment>>({});

  useEffect(() => {
    if (!selectedCompany) {
      setOutstandingBills([]);
      setBillAdjustments({});
      return;
    }

    fetch(`/api/vouchers?type=outstanding&partyId=${selectedCompany}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOutstandingBills(data);
          const initialAdjs: Record<number, BillAdjustment> = {};
          data.forEach((bill) => {
            const invDate = new Date(bill.voucherDate);
            const payDate = new Date(voucherDate);
            const days = Math.max(0, Math.floor((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));
            const rate = Number(bill.rateOfInterest || 0);
            const interest = Math.round(((bill.outstanding * rate * days) / 36500) * 100) / 100;

            initialAdjs[bill.voucherId] = {
              amount: "",
              days,
              interest,
            };
          });
          setBillAdjustments(initialAdjs);
        }
      })
      .catch((err) => console.error("Error fetching outstanding bills:", err));
  }, [selectedCompany, voucherDate]);

  // Sync total amount with adjustments
  const totalAdjusted = Object.values(billAdjustments).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAdjustmentChange = (vId: number, amtVal: string) => {
    setBillAdjustments((prev) => {
      const updated = { ...prev };
      const current = updated[vId];
      if (current) {
        // Recalculate interest based on entered amount
        const bill = outstandingBills.find((b) => b.voucherId === vId);
        const rate = bill ? Number(bill.rateOfInterest || 0) : 0;
        const enteredAmt = Number(amtVal) || 0;
        const interest = Math.round(((enteredAmt * rate * current.days) / 36500) * 100) / 100;
        updated[vId] = {
          ...current,
          amount: amtVal,
          interest,
        };
      }
      return updated;
    });
  };

  async function handleSubmit() {
    if (!canCreate) return;
    const finalAmount = totalAdjusted > 0 ? totalAdjusted : Number(amount);
    if (!voucherNo || !selectedCompany || !selectedLedger || finalAmount <= 0) {
      setMessage("Please fill in all fields and ensure amount is greater than 0.");
      return;
    }

    setSaving(true);
    setMessage(null);

    // Format bill details payload
    const selectedDetails = Object.entries(billAdjustments)
      .filter(([_, val]) => Number(val.amount) > 0)
      .map(([id, val]) => {
        const bill = outstandingBills.find((b) => String(b.voucherId) === id);
        return {
          voucherId: Number(id),
          voucherNo: bill ? bill.voucherNo : "",
          amount: Number(val.amount),
          interest: val.interest,
          days: val.days,
        };
      });

    try {
      const body = {
        voucherType: "payment",
        voucherNo,
        voucherDate,
        partyId: Number(selectedCompany),
        cashBankLedgerId: Number(selectedLedger),
        totalAmount: finalAmount,
        remarks: isReversal ? `[RETURN CHEQUE REVERSAL] ${remarks}` : remarks,
        lrNo: chequeNo || null, // storing cheque/txn ref in lrNo
        billDetails: selectedDetails.length > 0 ? selectedDetails : null,
        isReversal,
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
      const suppObj = companies.find((s) => String(s.companyId) === selectedCompany);

      const addedPayment: PaymentItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        remarks: newVoucher.remarks,
        companyName: suppObj ? suppObj.companyName : `ID ${newVoucher.partyId}`,
        customerName: null,
        lrNo: newVoucher.lrNo,
      };

      setPayments([addedPayment, ...payments]);
      setMessage("Payment voucher recorded successfully.");
      setIsCreating(false);

      // Reset form
      setVoucherNo("");
      setSelectedCompany("");
      setSelectedLedger("");
      setAmount("0");
      setRemarks("");
      setChequeNo("");
      setIsReversal(false);
      setOutstandingBills([]);
      setBillAdjustments({});
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
              <p className="text-xs text-muted-foreground mt-0.5">Credit cash/bank and debit company ledger.</p>
            </div>
          </div>
          <Badge variant="secondary">Payment</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voucher No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="PAY-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash / Bank Account (Credit)</Label>
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

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company (Debit)</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger><SelectValue placeholder="Choose company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((s) => (
                    <SelectItem key={s.companyId} value={String(s.companyId)}>
                      {s.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cheque / Reference No</Label>
              <Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="Cheque No / Transaction ID" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={totalAdjusted > 0 ? totalAdjusted.toFixed(2) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={totalAdjusted > 0}
              />
              {totalAdjusted > 0 && (
                <p className="text-[10px] text-muted-foreground">Derived from adjusted bills below.</p>
              )}
            </div>
          </div>

          {/* Cheque Return Toggle */}
          <div className="flex items-center gap-2 py-2 border-t border-b border-border/50">
            <input
              type="checkbox"
              id="isReversal"
              checked={isReversal}
              onChange={(e) => setIsReversal(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isReversal" className="text-xs font-semibold uppercase tracking-wider text-danger cursor-pointer">
              Mark as Cheque Return / Bounce Log (Reverses double entry)
            </Label>
          </div>

          {/* Outstanding Bills Table Section */}
          {outstandingBills.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Against Outstanding Invoices (Select & adjust payment amount)
              </Label>
              <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-left font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Invoice No</th>
                      <th className="px-3 py-2">Invoice Date</th>
                      <th className="px-3 py-2 text-right">Net Amt</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-3 py-2 text-right">Days</th>
                      <th className="px-3 py-2 text-right">Int Rate (%)</th>
                      <th className="px-3 py-2 text-right">Int Amount</th>
                      <th className="px-3 py-2 w-32">Pay Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingBills.map((bill) => {
                      const adj = billAdjustments[bill.voucherId] || { amount: "", days: 0, interest: 0 };
                      return (
                        <tr key={bill.voucherId} className="border-t border-border/50 bg-card hover:bg-muted/10">
                          <td className="px-3 py-2 font-medium text-foreground">{bill.voucherNo}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {bill.voucherDate ? new Date(bill.voucherDate).toISOString().slice(0, 10) : "N/A"}
                          </td>
                          <td className="px-3 py-2 text-right text-foreground">₹{bill.netAmount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-foreground">₹{bill.outstanding.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{adj.days}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{bill.rateOfInterest}%</td>
                          <td className="px-3 py-2 text-right text-foreground">₹{adj.interest.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              className="h-8 py-1 text-xs"
                              placeholder="0.00"
                              value={adj.amount}
                              onChange={(e) => handleAdjustmentChange(bill.voucherId, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Payment sent against purchase invoice" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : isReversal ? "Record Reversal / Return" : "Record Payment"}
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
            Review cash and company payment entries recorded in your company.
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
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Voucher No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Ref No (Cheque)</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No payment vouchers recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => {
                const partyName = payment.companyName || payment.customerName || `ID ${payment.partyId}`;
                const hasReversal = payment.remarks?.includes("[RETURN CHEQUE REVERSAL]");
                return (
                  <tr key={payment.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {payment.voucherNo}{" "}
                      {hasReversal && (
                        <Badge variant="outline" className="text-danger border-danger/20 bg-danger/5 scale-90">
                          Bounced
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {payment.voucherDate ? new Date(payment.voucherDate).toISOString().slice(0, 10) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">{payment.lrNo || "—"}</td>
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
