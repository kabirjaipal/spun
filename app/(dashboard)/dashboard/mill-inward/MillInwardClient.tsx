"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";
import MillFormDrawer from "@/components/MillFormDrawer";

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
  hsnCode?: string | null;
}

interface TaxRateOption {
  taxRateId: number;
  taxName: string;
  taxPercent: string;
}

interface BrokerHasteOption {
  id: number;
  name: string;
  type: string;
}

interface OutwardVoucher {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  partyId: number | null;
  lotNo: string | null;
}

interface OutwardItem {
  voucherItemId: number;
  voucherId: number;
  inventoryId: number;
  hsnCode: string | null;
  pcs: number;
  quantity: string;
  fold: string;
  rate: string;
  jobType: string | null;
  jobRateType: string | null;
  gstRateId: number | null;
}

interface LineItem {
  id: string;
  inventoryId: string;
  hsnCode: string;
  outwardPcs: number;
  outwardQuantity: number;
  pcs: string; // inward pcs
  quantity: string; // inward meters
  fold: string;
  rate: string; // mill rate
  jobType: string;
  jobRateType: "pcs" | "mtr";
  gstRateId: string;
}

export default function MillInwardClient({
  company,
  mills,
  inventory,
  taxRates,
  outwardVouchers,
  outwardItems,
  brokersHaste,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  mills: MillOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  outwardVouchers: OutwardVoucher[];
  outwardItems: OutwardItem[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
}) {
  const [localMills, setLocalMills] = useState<MillOption[]>(mills);
  const [showMillModal, setShowMillModal] = useState(false);

  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);
  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  function handleMillCreated(newMill: any) {
    const newOption: MillOption = {
      millId: newMill.millId,
      millName: newMill.millName,
      address: newMill.address,
      gstNo: newMill.gstNo,
    };
    setLocalMills((prev) => [...prev, newOption]);
    setSelectedMill(String(newMill.millId));
  }

  const [selectedMill, setSelectedMill] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [showHasteDialog, setShowHasteDialog] = useState(false);
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState(new Date().toISOString().slice(0, 10));
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [personName, setPersonName] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  // Filter outward lots based on selected mill party
  const partyOutwardVouchers = useMemo(() => {
    if (!selectedMill) return [];
    return outwardVouchers.filter((v) => v.partyId === Number(selectedMill));
  }, [selectedMill, outwardVouchers]);

  // Load outward items when lot/voucher is selected
  useEffect(() => {
    if (!selectedVoucherId) {
      setLineItems([]);
      return;
    }

    const matchedItems = outwardItems.filter((item) => item.voucherId === Number(selectedVoucherId));
    const itemsMapped = matchedItems.map((item) => ({
      id: crypto.randomUUID(),
      inventoryId: String(item.inventoryId),
      hsnCode: item.hsnCode || "",
      outwardPcs: item.pcs,
      outwardQuantity: Number(item.quantity) || 0,
      pcs: String(item.pcs),
      quantity: String(item.quantity),
      fold: String(item.fold),
      rate: String(item.rate),
      jobType: item.jobType || "processing",
      jobRateType: (item.jobRateType || "mtr") as "pcs" | "mtr",
      gstRateId: item.gstRateId ? String(item.gstRateId) : "",
    }));

    setLineItems(itemsMapped);

    // Auto-fill metadata if available
    const parentVoucher = outwardVouchers.find((v) => v.voucherId === Number(selectedVoucherId));
    if (parentVoucher) {
      setRemarks(`Inward against MO Lot: ${parentVoucher.lotNo || ""}`);
    }
  }, [selectedVoucherId, outwardItems, outwardVouchers]);

  const selectedMillDetails = useMemo(() => {
    return localMills.find((m) => String(m.millId) === selectedMill) || null;
  }, [selectedMill, localMills]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;

      const unit = line.jobRateType === "pcs" ? pcs : qty;
      const amount = Math.round((unit * rate) * 100) / 100;
      const netAmount = Math.round(((unit * rate * fold) / 100) * 100) / 100;

      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      const totalTax = Math.round((netAmount * gstRatePercent) / 100 * 100) / 100;

      // Shortage calculation (outward - inward)
      const shortageQty = Math.max(0, line.outwardQuantity - qty);
      const shortagePcs = Math.max(0, line.outwardPcs - pcs);
      const shortagePercent = line.outwardQuantity > 0 ? Math.round((shortageQty / line.outwardQuantity) * 100 * 100) / 100 : 0;

      return { amount, netAmount, totalTax, net: netAmount + totalTax, shortageQty, shortagePcs, shortagePercent };
    });
  }, [lineItems, taxRates]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        netAmount: acc.netAmount + item.netAmount,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, netAmount: 0, tax: 0, total: 0 }
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
            hsnCode: prod?.hsnCode || "",
            gstRateId: prod?.gstRateId ? String(prod.gstRateId) : "",
          };
        }

        return { ...item, [field]: value };
      })
    );
  }

  function addLine() {
    setLineItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        inventoryId: "",
        hsnCode: "",
        outwardPcs: 0,
        outwardQuantity: 0,
        pcs: "0",
        quantity: "0",
        fold: "100",
        rate: "0",
        jobType: "processing",
        jobRateType: "mtr",
        gstRateId: "",
      },
    ]);
  }

  function removeLine(id: string) {
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedMill || !voucherNo || !selectedVoucherId) {
      setMessage("Select Mill Party, Outward Lot and enter inward challan number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId);
    if (validLines.length === 0) {
      setMessage("Add at least one line item.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const parentVoucher = outwardVouchers.find((v) => v.voucherId === Number(selectedVoucherId));

    try {
      const body = {
        voucherType: "mill_inward",
        voucherNo,
        voucherDate,
        partyId: Number(selectedMill),
        remarks: remarks || "Mill Inward Challan",
        broker,
        haste,
        lrNo,
        lrDate: lrDate || null,
        transport,
        vehicleNo,
        personName,
        lotNo: parentVoucher?.lotNo || null,
        printRate,
        printAmount,
        parentVoucherId: Number(selectedVoucherId),
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryId: Number(line.inventoryId),
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
        throw new Error(json.error || "Failed to save Mill Inward voucher.");
      }

      setMessage("Mill Inward Challan created successfully.");
      setVoucherNo("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setSelectedVoucherId("");
      setLineItems([]);

      // Print preview setup
      setPrintVoucher({
        voucher: {
          voucherNo: body.voucherNo,
          voucherDate: body.voucherDate,
          voucherType: "mill_inward",
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Mill Inward Entry</h1>
          <p className="text-sm text-muted-foreground">Receive processed fabric/yarn from mills and track lot shortage.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Mill & Outward Lot selection */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party & Lot</h2>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase text-foreground">Mill Party</Label>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setShowMillModal(true)}
                  className="text-[10px] font-bold text-primary hover:underline uppercase"
                >
                  + New Mill Party
                </button>
              )}
            </div>
            <Select value={selectedMill} onValueChange={(v) => { setSelectedMill(v); setSelectedVoucherId(""); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose Mill party" />
              </SelectTrigger>
              <SelectContent>
                {localMills.map((m) => (
                  <SelectItem key={m.millId} value={String(m.millId)}>
                    {m.millName} {m.gstNo ? `(${m.gstNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Outward Lot No / Challan</Label>
            <Select value={selectedVoucherId} onValueChange={setSelectedVoucherId} disabled={!selectedMill}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={selectedMill ? "Select Outward Lot" : "Select Mill first"} />
              </SelectTrigger>
              <SelectContent>
                {partyOutwardVouchers.map((v) => (
                  <SelectItem key={v.voucherId} value={String(v.voucherId)}>
                    Lot: {v.lotNo || "N/A"} (MO: {v.voucherNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Document Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Inward Challan No.</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. MI-5002" className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Inward Date</Label>
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Agent</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Broker</Label>
                <button type="button" onClick={() => setShowBrokerDialog(true)} className="text-[10px] font-bold text-primary hover:underline uppercase">+ New Broker</button>
              </div>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Choose Broker" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Haste (Delivery Agent)</Label>
                <button type="button" onClick={() => setShowHasteDialog(true)} className="text-[10px] font-bold text-primary hover:underline uppercase">+ New Haste</button>
              </div>
              <Select value={haste} onValueChange={setHaste}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Choose Haste" />
                </SelectTrigger>
                <SelectContent>
                  {hastes.map((h) => (
                    <SelectItem key={h.id} value={h.name}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Vehicle No.</Label>
              <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="Vehicle No" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Person/Driver</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Name" className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR No.</Label>
              <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="LR No" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
              <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      {lineItems.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Inward Items, Shortage & Matching</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Edit inward PCS/Quantity and view calculated shortage.</p>
            </div>
            <Button variant="outline" onClick={addLine} className="h-9 text-xs font-semibold uppercase">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Item
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1600px]">
              <thead>
                <tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                <th className="py-2 pr-2 w-[14%]">Item</th>
                  <th className="py-2 px-2 w-[8%]">HSN Code</th>
                  <th className="py-2 px-2 w-[6%] text-center">Fold%</th>
                  <th className="py-2 px-2 w-[8%] text-center">Outward PCS</th>
                  <th className="py-2 px-2 w-[8%] text-center">Inward PCS</th>
                  <th className="py-2 px-2 w-[8%] text-center">Outward Qty</th>
                  <th className="py-2 px-2 w-[8%] text-center">Inward Qty</th>
                  <th className="py-2 px-2 w-[8%] text-center">Shortage %</th>
                  <th className="py-2 px-2 w-[8%]">Rate</th>
                  <th className="py-2 px-2 w-[8%] text-right">Amount</th>
                  <th className="py-2 px-2 w-[8%] text-right">Net Amount</th>
                  <th className="py-2 pl-2 w-[4%]"></th>
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
                            <SelectValue placeholder="Item" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory.map((p) => (
                              <SelectItem key={p.inventoryId} value={String(p.inventoryId)}>
                                {p.inventoryName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-2">
                        <Input
                          value={line.hsnCode}
                          onChange={(e) => updateLine(line.id, "hsnCode", e.target.value)}
                          placeholder="HSN Code"
                          className="h-9 font-mono text-xs"
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

                      <td className="py-3 px-2 text-center font-mono text-xs text-muted-foreground">
                        {line.outwardPcs}
                      </td>

                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          value={line.pcs}
                          onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                          className="h-9 font-mono text-xs text-center"
                        />
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-xs text-muted-foreground">
                        {line.outwardQuantity}
                      </td>

                      <td className="py-3 px-2">
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                          className="h-9 font-mono text-xs text-center"
                        />
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-xs font-bold text-destructive">
                        {totals.shortagePercent > 0 ? `${totals.shortagePercent.toFixed(2)}%` : "-"}
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
                      <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                        ₹ {totals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 pl-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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
              <div className="text-muted-foreground">Total Inward Amount:</div>
              <div className="text-lg font-black text-foreground">
                ₹ {grandTotals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold text-destructive uppercase">{message}</p>
        <Button onClick={handleSubmit} disabled={saving || lineItems.length === 0} className="h-10 text-xs font-bold uppercase tracking-wider px-8 ml-auto">
          {saving ? "Saving challan..." : "Save Mill Inward"}
        </Button>
      </div>

      <BrokerHasteDialog
        type="broker"
        open={showBrokerDialog}
        onOpenChange={setShowBrokerDialog}
        onCreated={(item) => {
          setBroker(item.name);
          setBrokersHasteData((prev) => [...prev, item]);
        }}
      />
      <BrokerHasteDialog
        type="haste"
        open={showHasteDialog}
        onOpenChange={setShowHasteDialog}
        onCreated={(item) => {
          setHaste(item.name);
          setBrokersHasteData((prev) => [...prev, item]);
        }}
      />
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
      <MillFormDrawer
        isOpen={showMillModal}
        onClose={() => setShowMillModal(false)}
        onCreated={handleMillCreated}
      />
    </div>
  );
}
