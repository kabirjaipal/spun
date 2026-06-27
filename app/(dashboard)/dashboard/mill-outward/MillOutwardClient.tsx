"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";

interface MillOption {
  millId: number;
  millName: string;
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

interface LineItem {
  id: string;
  inventoryId: string;
  ledgerId: string;
  hsnCode: string;
  pcs: string;
  quantity: string; // meter / quantity
  fold: string; // fold percentage (default 100)
  rate: string; // mill rate
  jobType: string; // e.g. processing, finishing, weaving etc.
  jobRateType: "pcs" | "mtr";
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
  jobType: "processing",
  jobRateType: "mtr",
  gstRateId: "",
});

export default function MillOutwardClient({
  company,
  mills,
  inventory,
  ledgers,
  taxRates,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  mills: MillOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const [selectedMill, setSelectedMill] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [personName, setPersonName] = useState("");
  const [lotNo, setLotNo] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  const selectedMillDetails = useMemo(() => {
    return mills.find((m) => String(m.millId) === selectedMill) || null;
  }, [selectedMill, mills]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;

      // Amount formula: if jobRateType is 'pcs', then pcs * rate. If 'mtr', then qty * rate * fold / 100.
      const multiplier = line.jobRateType === "pcs" ? pcs : (qty * fold / 100);
      const amount = Math.round((multiplier * rate) * 100) / 100;

      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      const totalTax = Math.round((amount * gstRatePercent) / 100 * 100) / 100;

      return { amount, totalTax, net: amount + totalTax };
    });
  }, [lineItems, taxRates]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, tax: 0, total: 0 }
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

  const removeLine = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedMill || !voucherNo || !lotNo) {
      setMessage("Select Mill Party, enter lot number and voucher number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId && line.ledgerId);
    if (validLines.length === 0) {
      setMessage("Add at least one item with item and ledger specified.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "mill_outward",
        voucherNo,
        voucherDate,
        partyId: Number(selectedMill),
        remarks: remarks || "Mill Outward Challan",
        broker,
        haste,
        lrNo,
        lrDate: lrDate || null,
        transport,
        vehicleNo,
        personName,
        lotNo,
        printRate,
        printAmount,
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryId: Number(line.inventoryId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode,
            pcs: Number(line.pcs || 0),
            quantity: Number(line.quantity || 0),
            fold: Number(line.fold || 100),
            rate: Number(line.rate || 0),
            jobType: line.jobType,
            jobRateType: line.jobRateType,
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            taxableAmount: totals.amount,
            lineNet: totals.net,
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
        throw new Error(json.error || "Failed to save Mill Outward voucher.");
      }

      setMessage("Mill Outward Challan created successfully.");
      setVoucherNo("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLotNo("");
      setLineItems([EMPTY_LINE()]);

      // Print preview setup
      setPrintVoucher({
        voucher: {
          voucherNo: body.voucherNo,
          voucherDate: body.voucherDate,
          voucherType: "mill_outward",
          remarks: body.remarks,
          totalAmount: grandTotals.amount,
          taxAmount: grandTotals.tax,
          netAmount: grandTotals.total,
        },
        party: {
          name: selectedMillDetails?.millName || "Mill Party",
          gstNo: selectedMillDetails?.gstNo,
          address: selectedMillDetails?.address,
        },
        lines: validLines.map((line) => {
          const prod = inventory.find((p) => String(p.inventoryId) === line.inventoryId);
          const tr = taxRates.find((t) => String(t.taxRateId) === line.gstRateId);
          const qty = Number(line.quantity) || 0;
          const rt = Number(line.rate) || 0;
          const fd = Number(line.fold) || 100;
          const pcsVal = Number(line.pcs) || 0;
          const amt = line.jobRateType === "pcs" ? (pcsVal * rt) : (qty * rt * fd / 100);
          return {
            inventoryCode: prod?.inventoryCode || "PROD",
            inventoryName: prod?.inventoryName || "Item",
            quantity: qty,
            unit: prod?.unit || "MTR",
            rate: rt,
            fold: fd,
            amount: Math.round(amt * 100) / 100,
            gstPercent: Number(tr?.taxPercent || 0),
          };
        }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save voucher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 container mx-auto p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Mill Outward Entry</h1>
          <p className="text-sm text-muted-foreground">Send grey fabric/yarn to mills for processing/finishing.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Mill Details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Mill Party</Label>
            <Select value={selectedMill} onValueChange={setSelectedMill}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose Mill party" />
              </SelectTrigger>
              <SelectContent>
                {mills.map((m) => (
                  <SelectItem key={m.millId} value={String(m.millId)}>
                    {m.millName} {m.gstNo ? `(${m.gstNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Broker</Label>
            <Input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Broker Name" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Haste (Delivery Agent)</Label>
            <Input value={haste} onChange={(e) => setHaste(e.target.value)} placeholder="Haste / Courier" className="h-9" />
          </div>
        </div>

        {/* Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Document Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Challan / Sr No.</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. MO-1020" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Lot No.</Label>
            <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="e.g. LOT-450" className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Challan Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes" className="h-9" />
            </div>
          </div>
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Shipping</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Vehicle No.</Label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. GJ-05-XX-XXXX" className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Driver/Person Name</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Transport</Label>
              <Input value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="Transport Service" className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR No.</Label>
              <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="LR Number" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
              <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Mill Outward Items & Specifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Input inventory, PCS, meters (Qty), fold, processing types, and rates.</p>
          </div>
          <Button variant="outline" onClick={addLine} className="h-9 text-xs font-semibold uppercase">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                <th className="py-2 pr-2 w-[22%]">Item</th>
                <th className="py-2 px-2 w-[18%]">Ledger</th>
                <th className="py-2 px-2 w-[8%]">PCS</th>
                <th className="py-2 px-2 w-[10%]">Meters</th>
                <th className="py-2 px-2 w-[6%]">Fold%</th>
                <th className="py-2 px-2 w-[10%]">Process Type</th>
                <th className="py-2 px-2 w-[8%]">Per</th>
                <th className="py-2 px-2 w-[8%]">Rate</th>
                <th className="py-2 px-2 w-[10%] text-right">Amount</th>
                <th className="py-2 pl-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {lineItems.map((line, index) => {
                const totals = lineTotals[index];
                return (
                  <tr key={line.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-2">
                      <Select value={line.inventoryId} onValueChange={(v) => updateLine(line.id, "inventoryId", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((p) => (
                            <SelectItem key={p.inventoryId} value={String(p.inventoryId)}>
                              {p.inventoryName} ({p.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-3 px-2">
                      <Select value={line.ledgerId} onValueChange={(v) => updateLine(line.id, "ledgerId", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select ledger" />
                        </SelectTrigger>
                        <SelectContent>
                          {ledgers.map((l) => (
                            <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>
                              {l.ledgerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.pcs}
                        onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                        className="h-9 font-mono text-xs text-center"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        className="h-9 font-mono text-xs text-center"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.fold}
                        onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                        className="h-9 font-mono text-xs text-center"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <Select value={line.jobType} onValueChange={(v) => updateLine(line.id, "jobType", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Process type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="finishing">Finishing</SelectItem>
                          <SelectItem value="dyeing">Dyeing</SelectItem>
                          <SelectItem value="weaving">Weaving</SelectItem>
                          <SelectItem value="bleaching">Bleaching</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-3 px-2">
                      <Select value={line.jobRateType} onValueChange={(v) => updateLine(line.id, "jobRateType", v as any)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mtr">Mtr</SelectItem>
                          <SelectItem value="pcs">Pcs</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.rate}
                        onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                        className="h-9 font-mono text-xs text-right"
                      />
                    </td>

                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                      ₹ {totals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 pl-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={lineItems.length === 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-border pt-4 gap-4 text-xs">
          {/* Print Controls */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Label className="text-xs uppercase font-semibold text-muted-foreground">Print Challan:</Label>
              <select
                value={printRate ? "yes" : "no"}
                onChange={(e) => setPrintRate(e.target.value === "yes")}
                className="h-9 rounded border border-border bg-background px-3 py-1 font-semibold uppercase text-xs"
              >
                <option value="yes">Print Rate (Yes)</option>
                <option value="no">Print Rate (No)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={printAmount ? "yes" : "no"}
                onChange={(e) => setPrintAmount(e.target.value === "yes")}
                className="h-9 rounded border border-border bg-background px-3 py-1 font-semibold uppercase text-xs"
              >
                <option value="yes">Print Amount (Yes)</option>
                <option value="no">Print Amount (No)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 text-right font-mono">
            <div className="text-muted-foreground">Total Outward Amount:</div>
            <div className="text-lg font-black text-foreground">
              ₹ {grandTotals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Message and Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold text-destructive uppercase">{message}</p>
        <Button onClick={handleSubmit} disabled={saving} className="h-10 text-xs font-bold uppercase tracking-wider px-8 ml-auto">
          {saving ? "Saving challan..." : "Save Mill Outward"}
        </Button>
      </div>

      {printVoucher && (
        <PrintInvoiceModal
          isOpen={!!printVoucher}
          onClose={() => setPrintVoucher(null)}
          company={company}
          party={printVoucher.party}
          voucher={printVoucher.voucher}
          lines={printVoucher.lines}
        />
      )}
    </div>
  );
}
