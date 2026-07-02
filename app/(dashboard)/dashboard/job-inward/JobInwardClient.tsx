"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";

interface JobOption {
  jobId: number;
  jobName: string;
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
  rate: string; // job rate
  jobType: string;
  jobRateType: "pcs" | "mtr";
  gstRateId: string;
}

export default function JobInwardClient({
  company,
  jobs,
  inventory,
  taxRates,
  outwardVouchers,
  outwardItems,
  brokersHaste,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  jobs: JobOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  outwardVouchers: OutwardVoucher[];
  outwardItems: OutwardItem[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
}) {
  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);
  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  const [selectedJob, setSelectedJob] = useState("");
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

  // Filter outward lots based on selected job party
  const partyOutwardVouchers = useMemo(() => {
    if (!selectedJob) return [];
    return outwardVouchers.filter((v) => v.partyId === Number(selectedJob));
  }, [selectedJob, outwardVouchers]);

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
      jobType: item.jobType || "dyeing",
      jobRateType: (item.jobRateType || "mtr") as "pcs" | "mtr",
      gstRateId: item.gstRateId ? String(item.gstRateId) : "",
    }));

    setLineItems(itemsMapped);

    // Auto-fill metadata if available
    const parentVoucher = outwardVouchers.find((v) => v.voucherId === Number(selectedVoucherId));
    if (parentVoucher) {
      setRemarks(`Inward against JO Lot: ${parentVoucher.lotNo || ""}`);
    }
  }, [selectedVoucherId, outwardItems, outwardVouchers]);

  const selectedJobDetails = useMemo(() => {
    return jobs.find((j) => String(j.jobId) === selectedJob) || null;
  }, [selectedJob, jobs]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;

      const multiplier = line.jobRateType === "pcs" ? pcs : (qty * fold / 100);
      const amount = Math.round((multiplier * rate) * 100) / 100;

      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      const totalTax = Math.round((amount * gstRatePercent) / 100 * 100) / 100;

      // Shortage calculation (outward - inward)
      const shortageQty = Math.max(0, line.outwardQuantity - qty);
      const shortagePcs = Math.max(0, line.outwardPcs - pcs);

      return { amount, totalTax, net: amount + totalTax, shortageQty, shortagePcs };
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
        jobType: "dyeing",
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
    if (!selectedJob || !voucherNo || !selectedVoucherId) {
      setMessage("Select Job Party, Outward Lot and enter inward challan number.");
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
        voucherType: "job_inward",
        voucherNo,
        voucherDate,
        partyId: Number(selectedJob),
        remarks: remarks || "Job Inward Challan",
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
        throw new Error(json.error || "Failed to save Job Inward voucher.");
      }

      setMessage("Job Inward Challan created successfully.");
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
          voucherType: "job_inward",
          remarks: body.remarks,
          totalAmount: grandTotals.amount,
          taxAmount: grandTotals.tax,
          netAmount: grandTotals.total,
        },
        party: {
          name: selectedJobDetails?.jobName || "Job Party",
          gstNo: selectedJobDetails?.gstNo,
          address: selectedJobDetails?.address,
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Job Inward Entry</h1>
          <p className="text-sm text-muted-foreground">Receive finished fabric/yarn from job workers and track lot shortage.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Job Worker & Outward Lot selection */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party & Lot</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Job Party</Label>
            <Select value={selectedJob} onValueChange={(v) => { setSelectedJob(v); setSelectedVoucherId(""); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose Job worker" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.jobId} value={String(j.jobId)}>
                    {j.jobName} {j.gstNo ? `(${j.gstNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Outward Lot No / Challan</Label>
            <Select value={selectedVoucherId} onValueChange={setSelectedVoucherId} disabled={!selectedJob}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={selectedJob ? "Select Outward Lot" : "Select Job Party first"} />
              </SelectTrigger>
              <SelectContent>
                {partyOutwardVouchers.map((v) => (
                  <SelectItem key={v.voucherId} value={String(v.voucherId)}>
                    Lot: {v.lotNo || "N/A"} (JO: {v.voucherNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Inward Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Document Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Inward Challan / Sr No.</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. JI-1020" className="h-9" />
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Shipping</h2>

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
              <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="GJ-05-..." className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Person Name</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Driver Name" className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Inward Items Table */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Inward Fabric Details & Shortage Logs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track actual received quantities against job outward specifications.</p>
          </div>
          <Button variant="outline" onClick={addLine} disabled={!selectedVoucherId} className="h-9 text-xs font-semibold uppercase">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Manual Row
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                <th className="py-2 pr-2 w-[20%]">Item</th>
                <th className="py-2 px-2 w-[12%] text-center">Outward (PCS/Mtr)</th>
                <th className="py-2 px-2 w-[6%]">Fold%</th>
                <th className="py-2 px-2 w-[8%]">Inward PCS</th>
                <th className="py-2 px-2 w-[10%]">Inward Meters</th>
                <th className="py-2 px-2 w-[8%] text-center">Shortage</th>
                <th className="py-2 px-2 w-[8%]">Rate</th>
                <th className="py-2 px-2 w-[10%] text-right">Inward Amt</th>
                <th className="py-2 pl-2 w-[3%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs uppercase font-medium">
                    No items loaded. Please select an active Outward Lot above.
                  </td>
                </tr>
              ) : (
                lineItems.map((line, index) => {
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

                      <td className="py-3 px-2 text-center text-muted-foreground font-mono text-xs">
                        {line.outwardPcs} Pcs / {line.outwardQuantity} Mtr
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

                      <td className="py-3 px-2 text-center text-destructive font-mono font-bold text-xs">
                        {totals.shortagePcs > 0 && <span>{totals.shortagePcs} Pcs </span>}
                        {totals.shortageQty > 0 && <span>{totals.shortageQty.toFixed(2)} Mtr</span>}
                        {totals.shortagePcs === 0 && totals.shortageQty === 0 && <span className="text-success">-</span>}
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
                          className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
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
            <div className="text-muted-foreground">Total Inward Cost:</div>
            <div className="text-lg font-black text-foreground">
              ₹ {grandTotals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Message and Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold text-destructive uppercase">{message}</p>
        <Button onClick={handleSubmit} disabled={saving || lineItems.length === 0} className="h-10 text-xs font-bold uppercase tracking-wider px-8 ml-auto">
          {saving ? "Saving challan..." : "Save Job Inward"}
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
    </div>
  );
}
