"use client";
import { getLocalTodayString } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Pencil } from "lucide-react";

interface ReceiptItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  partyId: number | null;
  totalAmount: string;
  remarks: string | null;
  partyName: string | null;
  lrNo?: string | null; // Cheque / Ref No
  bankName?: string | null;
  paymentMethod?: string | null;
  cashBankLedgerId?: number | null;
  billDetails?: any;
  voucherType?: string;
}

interface PartyOption {
  partyId: number;
  partyName: string;
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

const getFieldConfig = (method: string) => {
  switch (method.toLowerCase()) {
    case "cheque":
      return { label: "Cheque No", placeholder: "Enter Cheque Number" };
    case "neft":
      return { label: "NEFT Ref No", placeholder: "Enter NEFT Reference Number" };
    case "rtgs":
      return { label: "RTGS Ref No", placeholder: "Enter RTGS Reference Number" };
    case "imps":
      return { label: "IMPS Ref No", placeholder: "Enter IMPS Reference Number" };
    case "google pay":
      return { label: "GPay Trans ID", placeholder: "Enter Google Pay Transaction ID" };
    case "upi":
      return { label: "UPI Ref No / UPI ID", placeholder: "Enter UPI Reference Number" };
    default:
      return { label: "Cheque / Reference No", placeholder: "Cheque No / Transaction ID" };
  }
};

export default function ReceiptClient({
  initialReceipts,
  parties,
  cashBankLedgers,
  canCreate,
  canUpdate,
  canDelete,
}: {
  initialReceipts: ReceiptItem[];
  parties: PartyOption[];
  cashBankLedgers: LedgerOption[];
  canCreate: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}) {
  const [receipts, setReceipts] = useState<ReceiptItem[]>(initialReceipts);
  const [isCreating, setIsCreating] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptItem | null>(null);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(getLocalTodayString());
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [amount, setAmount] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isReversal, setIsReversal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEditingReceipt(null);
    setVoucherNo("");
    setSelectedParty("");
    setSelectedLedger("");
    setAmount("0");
    setRemarks("");
    setChequeNo("");
    setBankName("");
    setPaymentMethod("");
    setIsReversal(false);
    setOutstandingBills([]);
    setBillAdjustments({});
    fetchNextVoucherNo();
  };

  const handleEdit = (receipt: ReceiptItem) => {
    setEditingReceipt(receipt);
    setVoucherNo(receipt.voucherNo);
    setVoucherDate(receipt.voucherDate ? new Date(receipt.voucherDate).toISOString().slice(0, 10) : getLocalTodayString());
    setSelectedParty(receipt.partyId ? String(receipt.partyId) : "");
    setSelectedLedger(receipt.cashBankLedgerId ? String(receipt.cashBankLedgerId) : "");
    
    const hasReversal = receipt.remarks?.includes("[RETURN CHEQUE REVERSAL]");
    setIsReversal(!!hasReversal);
    if (hasReversal) {
      setRemarks(receipt.remarks?.replace("[RETURN CHEQUE REVERSAL]", "").trim() || "");
    } else {
      setRemarks(receipt.remarks || "");
    }
    
    setAmount(receipt.totalAmount || "0");
    setChequeNo(receipt.lrNo || "");
    setBankName(receipt.bankName || "");
    setPaymentMethod(receipt.paymentMethod || "");
    setIsCreating(true);
  };

  // Bill adjustments states
  const [outstandingBills, setOutstandingBills] = useState<OutstandingBill[]>([]);
  const [billAdjustments, setBillAdjustments] = useState<Record<number, BillAdjustment>>({});

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=receipt");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next receipt voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  useEffect(() => {
    if (!selectedParty) {
      setOutstandingBills([]);
      setBillAdjustments({});
      return;
    }

    fetch(`/api/vouchers?type=outstanding&partyId=${selectedParty}&invoiceType=sale`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          let mergedOutstanding = [...data];
          const initialAdjs: Record<number, BillAdjustment> = {};

          mergedOutstanding.forEach((bill) => {
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

          if (editingReceipt && String(editingReceipt.partyId) === selectedParty && editingReceipt.billDetails) {
            const details = editingReceipt.billDetails as any[];
            details.forEach((adjItem) => {
              const vId = Number(adjItem.voucherId);
              const idx = mergedOutstanding.findIndex((b) => b.voucherId === vId);
              if (idx !== -1) {
                const bill = mergedOutstanding[idx];
                const updatedOutstanding = bill.outstanding + adjItem.amount;
                mergedOutstanding[idx] = {
                  ...bill,
                  outstanding: updatedOutstanding,
                  paidAmount: Math.max(0, bill.paidAmount - adjItem.amount),
                };
                
                const rate = Number(bill.rateOfInterest || 0);
                const payDate = new Date(voucherDate);
                const invDate = new Date(bill.voucherDate);
                const days = Math.max(0, Math.floor((payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));
                const interest = Math.round(((adjItem.amount * rate * days) / 36500) * 100) / 100;
                
                initialAdjs[vId] = {
                  amount: String(adjItem.amount),
                  days,
                  interest,
                };
              } else {
                mergedOutstanding.push({
                  voucherId: adjItem.voucherId,
                  voucherNo: adjItem.voucherNo,
                  voucherDate: new Date().toISOString(),
                  netAmount: adjItem.amount,
                  paidAmount: 0,
                  outstanding: adjItem.amount,
                  rateOfInterest: 0,
                  creditDays: 0,
                });
                
                initialAdjs[vId] = {
                  amount: String(adjItem.amount),
                  days: adjItem.days || 0,
                  interest: adjItem.interest || 0,
                };
              }
            });
          }

          setOutstandingBills(mergedOutstanding);
          setBillAdjustments(initialAdjs);
        }
      })
      .catch((err) => console.error("Error fetching outstanding bills:", err));
  }, [selectedParty, voucherDate, editingReceipt]);

  // Sync total amount with adjustments
  const totalAdjusted = Object.values(billAdjustments).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAdjustmentChange = (vId: number, amtVal: string) => {
    setBillAdjustments((prev) => {
      const updated = { ...prev };
      const current = updated[vId];
      if (current) {
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
    if (!canCreate && !editingReceipt) return;
    const finalAmount = totalAdjusted > 0 ? totalAdjusted : Number(amount);
    if (!voucherNo || !selectedParty || !selectedLedger || finalAmount <= 0) {
      setMessage("Please fill in all fields and ensure amount is greater than 0.");
      return;
    }

    setSaving(true);
    setMessage(null);

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

    const selectedCashBankLedger = cashBankLedgers.find((l) => String(l.ledgerId) === selectedLedger);
    const isCashSelected = selectedCashBankLedger?.ledgerType === "cash";

    try {
      const body = {
        voucherType: "receipt",
        voucherNo,
        voucherDate,
        partyId: Number(selectedParty),
        cashBankLedgerId: Number(selectedLedger),
        totalAmount: finalAmount,
        remarks: isReversal ? `[RETURN CHEQUE REVERSAL] ${remarks}` : remarks,
        lrNo: isCashSelected ? null : (chequeNo || null),
        bankName: isCashSelected ? null : (bankName || null),
        paymentMethod: isCashSelected ? null : (paymentMethod || null),
        billDetails: selectedDetails.length > 0 ? selectedDetails : null,
        isReversal,
      };

      const url = editingReceipt ? `/api/vouchers/${editingReceipt.voucherId}` : "/api/vouchers";
      const method = editingReceipt ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || `Failed to ${editingReceipt ? "update" : "create"} receipt voucher.`);
      }

      const newVoucher = await response.json();
      const custObj = parties.find((c) => String(c.partyId) === selectedParty);

      const addedReceipt: ReceiptItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        partyId: newVoucher.partyId,
        totalAmount: String(newVoucher.totalAmount),
        remarks: newVoucher.remarks,
        partyName: custObj ? custObj.partyName : `ID ${newVoucher.partyId}`,
        lrNo: newVoucher.lrNo,
        bankName: newVoucher.bankName,
        paymentMethod: newVoucher.paymentMethod,
        cashBankLedgerId: newVoucher.cashBankLedgerId,
        billDetails: newVoucher.billDetails,
      };

      if (editingReceipt) {
        setReceipts(receipts.map((r) => r.voucherId === editingReceipt.voucherId ? addedReceipt : r));
        setMessage("Receipt voucher updated successfully.");
      } else {
        setReceipts([addedReceipt, ...receipts]);
        setMessage("Receipt voucher recorded successfully.");
      }
      setIsCreating(false);
      resetForm();
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
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">{editingReceipt ? "Edit Receipt Voucher" : "Record Receipt Voucher"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Debit cash/bank and credit party ledger.</p>
            </div>
          </div>
          <Badge variant="secondary">Receipt</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Voucher No</Label>
              <Input
                value={voucherNo}
                readOnly
                disabled
                placeholder="Fetching..."
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Cash / Bank Account (Debit)</Label>
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
              <Label>Account (Credit)</Label>
              <Select value={selectedParty} onValueChange={setSelectedParty}>
                <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                <SelectContent>
                  {parties.map((c) => (
                    <SelectItem key={c.partyId} value={String(c.partyId)}>
                      {c.partyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (₹)</Label>
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

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Receipt received against sales invoice" />
            </div>
          </div>

          {!(cashBankLedgers.find((l) => String(l.ledgerId) === selectedLedger)?.ledgerType === "cash") && (
            <div className="grid gap-4 lg:grid-cols-3 border-t border-border/30 pt-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="neft">NEFT</SelectItem>
                    <SelectItem value="rtgs">RTGS</SelectItem>
                    <SelectItem value="imps">IMPS</SelectItem>
                    <SelectItem value="google pay">Google Pay</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {getFieldConfig(paymentMethod).label}
                </Label>
                <Input
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder={getFieldConfig(paymentMethod).placeholder}
                />
              </div>
            </div>
          )}

          {/* Cheque Return Toggle (Show ONLY in Edit Mode) */}
          {editingReceipt !== null && (
            <div className="flex items-center gap-2 py-2 border-t border-b border-border/50">
              <input
                type="checkbox"
                id="isReversal"
                checked={isReversal}
                onChange={(e) => setIsReversal(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isReversal" className="cursor-pointer">
                Mark as Cheque Return / Bounce Log (Reverses double entry)
              </Label>
            </div>
          )}

          {/* Outstanding Bills Table Section */}
          {outstandingBills.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="block">
                Against Outstanding Invoices (Select & adjust received amount)
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
                      <th className="px-3 py-2 w-32">Rec Amount</th>
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
                            <Input type="number" className="h-8" placeholder="0.00" value={adj.amount} onChange={(e) => handleAdjustmentChange(bill.voucherId, e.target.value)}
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


        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setIsCreating(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || (!canCreate && !editingReceipt)}>
            {saving ? (
              <>
                <Spinner className="mr-2" />
                Saving
              </>
            ) : isReversal ? (
              editingReceipt ? "Update Reversal / Return" : "Record Reversal / Return"
            ) : (
              editingReceipt ? "Update Receipt" : "Record Receipt"
            )}
          </Button>
        </div>
      </div>
    );
  }

  const totalReceipts = receipts.reduce((sum, item) => {
    const isReceiptRev = item.remarks?.includes("[RETURN CHEQUE REVERSAL]") && item.voucherType === "receipt";
    const amt = Number(item.totalAmount ?? 0);
    if (isReceiptRev) return sum - amt;
    return sum + amt;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Receipt Vouchers</h1>
        </div>
        {canCreate && (
          <Button onClick={() => { setIsCreating(true); setEditingReceipt(null); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Receipt
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recent Receipts</p>
          <p className="mt-3 text-3xl font-bold text-foreground">{receipts.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Amount</p>
          <p className="mt-3 text-3xl font-bold text-foreground">₹{totalReceipts.toFixed(2)}</p>
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
              {(canUpdate || canDelete) && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={(canUpdate || canDelete) ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No receipt vouchers recorded yet.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => {
                const partyName = receipt.partyName || `ID ${receipt.partyId}`;
                const isReceiptRev = receipt.remarks?.includes("[RETURN CHEQUE REVERSAL]") && receipt.voucherType === "receipt";
                const isPaymentRev = receipt.remarks?.includes("[RETURN CHEQUE REVERSAL]") && receipt.voucherType === "payment";
                const hasReversalBadge = isReceiptRev || isPaymentRev;
                return (
                  <tr key={receipt.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {receipt.voucherNo}{" "}
                      {hasReversalBadge && (
                        <Badge variant="outline" className="text-danger border-danger/20 bg-danger/5 scale-90">
                          Bounced
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {receipt.voucherDate ? new Date(receipt.voucherDate).toISOString().slice(0, 10) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{partyName}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono">
                      {receipt.lrNo || "—"}
                      {receipt.bankName && (
                        <span className="block text-[10px] text-muted-foreground uppercase font-sans mt-0.5">
                          {receipt.paymentMethod || "Ref"}: {receipt.bankName}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${isReceiptRev ? "text-danger" : "text-foreground"}`}>
                      {isReceiptRev ? `(-) ₹${Number(receipt.totalAmount ?? 0).toFixed(2)}` : `₹${Number(receipt.totalAmount ?? 0).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{receipt.remarks || "—"}</td>
                    {(canUpdate || canDelete) && (
                      <td className="px-4 py-3 text-right space-x-2">
                        {canUpdate && !isPaymentRev && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(receipt)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    )}
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
