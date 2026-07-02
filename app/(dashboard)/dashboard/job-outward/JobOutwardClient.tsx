"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";
import JobFormDrawer from "@/components/JobFormDrawer";

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

interface LineItem {
  id: string;
  inventoryId: string;
  hsnCode: string;
  pcs: string;
  quantity: string; // meter / quantity
  fold: string; // fold percentage (default 100)
  rate: string; // job rate
  jobType: string; // e.g. dyeing, printing, etc.
  jobRateType: "pcs" | "mtr";
  gstRateId: string;
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  inventoryId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  fold: "100",
  rate: "0",
  jobType: "dyeing",
  jobRateType: "mtr",
  gstRateId: "",
});

export default function JobOutwardClient({
  company,
  jobs,
  inventory,
  taxRates,
  brokersHaste,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null };
  jobs: JobOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
}) {
  const [localJobs, setLocalJobs] = useState<JobOption[]>(jobs);
  const [showJobModal, setShowJobModal] = useState(false);

  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);
  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  function handleJobCreated(newJob: any) {
    const newOption: JobOption = {
      jobId: newJob.jobId,
      jobName: newJob.jobName,
      address: newJob.address,
      gstNo: newJob.gstNo,
    };
    setLocalJobs((prev) => [...prev, newOption]);
    setSelectedJob(String(newJob.jobId));
  }

  const [selectedJob, setSelectedJob] = useState("");
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
  const [lotNo, setLotNo] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  const selectedJobDetails = useMemo(() => {
    return localJobs.find((j) => String(j.jobId) === selectedJob) || null;
  }, [selectedJob, localJobs]);

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

      return { amount, netAmount, totalTax, net: netAmount + totalTax };
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
    setLineItems((items) => [...items, EMPTY_LINE()]);
  }

  function removeLine(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedJob || !voucherNo || !lotNo) {
      setMessage("Select Job Party, enter lot number and voucher number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId);
    if (validLines.length === 0) {
      setMessage("Add at least one item.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "job_outward",
        voucherNo,
        voucherDate,
        partyId: Number(selectedJob),
        remarks: remarks || "Job Outward Challan",
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
        lineItems: validLines.map((line, idx) => {
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
        throw new Error(json.error || "Failed to save Job Outward voucher.");
      }

      setMessage("Job Outward Challan created successfully.");
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
          voucherType: "job_outward",
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Job Outward Entry</h1>
          <p className="text-sm text-muted-foreground">Send grey fabric/yarn to job workers with job rates and specs.</p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party & Document Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Party */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Job Party</Label>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setShowJobModal(true)}
                    className="text-[10px] font-bold text-primary hover:underline uppercase"
                  >
                    + New Job Party
                  </button>
                )}
              </div>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choose Job worker" />
                </SelectTrigger>
                <SelectContent>
                  {localJobs.map((j) => (
                    <SelectItem key={j.jobId} value={String(j.jobId)}>
                      {j.jobName} {j.gstNo ? `(${j.gstNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Broker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Broker</Label>
                <button type="button" onClick={() => setShowBrokerDialog(true)} className="text-[10px] font-bold text-primary hover:underline uppercase">+ New Broker</button>
              </div>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="h-10 w-full">
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

            {/* Haste */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Haste (Delivery Agent)</Label>
                <button type="button" onClick={() => setShowHasteDialog(true)} className="text-[10px] font-bold text-primary hover:underline uppercase">+ New Haste</button>
              </div>
              <Select value={haste} onValueChange={setHaste}>
                <SelectTrigger className="h-10 w-full">
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

            {/* Challan / Sr No. */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Challan / Sr No.</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. JO-1020" className="h-10" />
            </div>

            {/* Lot No. */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Lot No.</Label>
              <Input value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="e.g. LOT-450" className="h-10" />
            </div>

            {/* Challan Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Challan Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-10" />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes" className="h-10" />
            </div>
          </div>
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Shipping</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Vehicle No.</Label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. GJ-05-XX-XXXX" className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Driver Name</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Driver Name" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Transport</Label>
              <Input value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="Transport Service" className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR No.</Label>
              <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="LR Number" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
              <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Container */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Job Outward Items & Specifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Input inventory, PCS, meters (Qty), fold, job types, and rate types.</p>
          </div>
          <Button variant="outline" onClick={addLine} className="h-10 text-xs font-semibold uppercase">
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {lineItems.map((line, index) => {
            const totals = lineTotals[index];
            return (
              <div key={line.id} className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 relative">
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Item #{index + 1}
                  </span>
                  {lineItems.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => removeLine(line.id)}
                      className="text-danger hover:bg-danger/10 hover:text-danger h-9 px-3 text-xs uppercase font-semibold flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> Remove Item
                    </Button>
                  )}
                </div>

                {/* Input Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Select Item */}
                  <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Select Item</Label>
                    <Select value={line.inventoryId} onValueChange={(v) => updateLine(line.id, "inventoryId", v)}>
                      <SelectTrigger className="h-10 w-full">
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
                  </div>

                  {/* HSN Code */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">HSN Code</Label>
                    <Input
                      value={line.hsnCode}
                      onChange={(e) => updateLine(line.id, "hsnCode", e.target.value)}
                      placeholder="HSN Code"
                      className="h-10"
                    />
                  </div>

                  {/* Fold */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Fold %</Label>
                    <Input
                      type="number"
                      value={line.fold}
                      onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                      className="h-10 text-right"
                    />
                  </div>

                  {/* PCS */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">PCS</Label>
                    <Input
                      type="number"
                      value={line.pcs}
                      onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                      className="h-10 text-right"
                    />
                  </div>

                  {/* Quantity (Meters) */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Quantity (Mtrs)</Label>
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                      className="h-10 text-right"
                    />
                  </div>

                  {/* Job Type */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Job Type</Label>
                    <Select value={line.jobType} onValueChange={(v) => updateLine(line.id, "jobType", v)}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Job type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dyeing">Dyeing</SelectItem>
                        <SelectItem value="printing">Printing</SelectItem>
                        <SelectItem value="weaving">Weaving</SelectItem>
                        <SelectItem value="stitching">Stitching</SelectItem>
                        <SelectItem value="embroidery">Embroidery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unit */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Unit</Label>
                    <Select value={line.jobRateType} onValueChange={(v) => updateLine(line.id, "jobRateType", v as any)}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mtr">Mtr</SelectItem>
                        <SelectItem value="pcs">Pcs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rate */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">Rate (₹)</Label>
                    <Input
                      type="number"
                      value={line.rate}
                      onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                      className="h-10 text-right"
                    />
                  </div>

                  {/* GST Rate */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-xs font-semibold uppercase text-foreground">GST Rate</Label>
                    <Select value={line.gstRateId} onValueChange={(v) => updateLine(line.id, "gstRateId", v)}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Tax %" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxRates.map((t) => (
                          <SelectItem key={t.taxRateId} value={String(t.taxRateId)}>
                            {t.taxName} ({t.taxPercent}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calculations Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">Amount</span>
                    <span className="font-semibold text-foreground text-sm">₹ {totals.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">Net Amount</span>
                    <span className="font-semibold text-foreground text-sm">₹ {totals.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">GST Tax</span>
                    <span className="font-semibold text-muted-foreground text-sm">₹ {totals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px] text-primary">Net Total</span>
                    <span className="font-bold text-foreground text-sm">₹ {totals.net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            );
          })}
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
          {saving ? "Saving challan..." : "Save Job Outward"}
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
      <JobFormDrawer
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        onCreated={handleJobCreated}
      />
    </div>
  );
}
