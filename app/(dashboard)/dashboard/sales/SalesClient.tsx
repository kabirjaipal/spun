"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, FileText } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";

interface PartyOption {
  partyId: number;
  partyName: string;
  gstNo: string | null;
  address: string | null;
  state?: string | null;
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

interface LineItem {
  id: string;
  inventoryId: string;
  hsnCode: string;
  pcs: string;
  quantity: string; // meters / quantity
  fold: string; // fold percentage (default 100)
  rate: string;
  gstRateId: string;
}

interface PastVoucher {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  remarks: string | null;
  party: { name: string; gstNo: string | null; address: string | null } | null;
}

interface BrokerHasteOption {
  id: number;
  name: string;
  type: string;
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  inventoryId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  fold: "100",
  rate: "0",
  gstRateId: "",
});

const fmt = (n: number) => `₹${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export default function SalesClient({
  company,
  parties,
  inventory,
  taxRates,
  brokersHaste,
  canCreate,
  pastVouchers: initialPastVouchers,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null; companyType?: string; state?: string | null };
  parties: PartyOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
  pastVouchers: PastVoucher[];
}) {


  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);
  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  const [salesType, setSalesType] = useState<"grey" | "finished" | "other">("grey");
  const [selectedParty, setSelectedParty] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Textile-specific logistics fields
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

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);
  const [pastVouchers, setPastVouchers] = useState<PastVoucher[]>(initialPastVouchers);

  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const party = parties.find((c) => String(c.partyId) === selectedParty);
    if (company?.state && party?.state) {
      return company.state.trim().toLowerCase() !== party.state.trim().toLowerCase();
    }
    const companyGst = company?.gstNo || "";
    const partyGst = party?.gstNo || "";
    if (!companyGst || !partyGst) return false;
    return companyGst.slice(0, 2) !== partyGst.slice(0, 2);
  }, [company, selectedParty, parties]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      
      const amount = Math.round((qty * rate) * 100) / 100;
      const netAmount = Math.round(((qty * rate * fold) / 100) * 100) / 100;
      const totalTax = Math.round((netAmount * gstRatePercent) / 100 * 100) / 100;
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = totalTax;
      } else {
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax - cgst) * 100) / 100;
      }

      return { amount, netAmount, cgst, sgst, igst, totalTax, net: netAmount + totalTax };
    });
  }, [lineItems, taxRates, isInterstate]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        netAmount: acc.netAmount + item.netAmount,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, netAmount: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
    );
  }, [lineTotals]);

  function updateLine(id: string, field: keyof LineItem, value: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;

        // Auto-fill HSN and GST Rate when item changes
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

  function removeLine(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  function openReprint(v: PastVoucher) {
    setPrintVoucher({
      voucher: {
        voucherNo: v.voucherNo,
        voucherDate: v.voucherDate,
        voucherType: "sale",
        remarks: v.remarks,
        totalAmount: v.totalAmount,
        taxAmount: v.taxAmount,
        netAmount: v.netAmount,
      },
      party: v.party ?? { name: "Walk-in Customer", gstNo: null, address: null },
      lines: [], // No line-level details in summary repressing
    });
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedParty || !invoiceNo) {
      setMessage("Select party and enter invoice/voucher number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId && Number(line.quantity) >= 0 && Number(line.rate) >= 0);
    if (validLines.length === 0) {
      setMessage("Add at least one line item with item, quantity, and rate.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "sale",
        voucherNo: invoiceNo,
        voucherDate,
        partyId: Number(selectedParty),
        remarks: remarks || `Sales - ${salesType.toUpperCase()}`,
        broker,
        haste,
        lrNo,
        lrDate: lrDate || null,
        transport,
        vehicleNo,
        personName,
        printRate: true,
        printAmount: true,
        lineItems: validLines.map((line) => ({
          inventoryId: Number(line.inventoryId),
          hsnCode: line.hsnCode,
          pcs: Number(line.pcs || 0),
          quantity: Number(line.quantity),
          fold: Number(line.fold || 100),
          rate: Number(line.rate),
          gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
        })),
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to save sales voucher.");
      }

      const responseData = await response.json();
      setMessage("Sales voucher created successfully.");

      const party = parties.find((c) => String(c.partyId) === selectedParty);
      const newVoucher: PastVoucher = {
        voucherId: responseData.voucherId,
        voucherNo: body.voucherNo,
        voucherDate: body.voucherDate,
        status: "posted",
        totalAmount: grandTotals.netAmount,
        taxAmount: grandTotals.tax,
        netAmount: grandTotals.total,
        remarks: body.remarks,
        party: party ? { name: party.partyName, gstNo: party.gstNo, address: party.address } : null,
      };

      setPastVouchers((prev) => [newVoucher, ...prev]);

      // Print setup
      const invoiceLines = validLines.map((line) => {
        const prod = inventory.find((p) => String(p.inventoryId) === line.inventoryId);
        const tr = taxRates.find((t) => String(t.taxRateId) === line.gstRateId);
        const qty = Number(line.quantity) || 0;
        const rt = Number(line.rate) || 0;
        const fd = Number(line.fold) || 100;
        return {
          inventoryCode: prod?.inventoryCode || "PROD",
          inventoryName: prod?.inventoryName || "Item",
          quantity: qty,
          unit: prod?.unit || "MTR",
          rate: rt,
          fold: fd,
          amount: Math.round((qty * rt * fd / 100) * 100) / 100,
          gstPercent: Number(tr?.taxPercent || 0),
        };
      });

      setPrintVoucher({
        voucher: { ...newVoucher, voucherType: "sale" },
        party: newVoucher.party ?? { name: "Walk-in Customer", gstNo: null, address: null },
        lines: invoiceLines,
      });

      setInvoiceNo("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLineItems([EMPTY_LINE()]);
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Sales Invoice Entry</h1>
          <p className="text-sm text-muted-foreground">Record textile sales, fold calculations, and dispatch logistics.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["grey", "finished", "other"] as const).map((type) => (
            <Button
              key={type}
              variant={salesType === type ? "default" : "outline"}
              onClick={() => setSalesType(type)}
              className="text-xs uppercase font-semibold h-8"
            >
              {type} Sales
            </Button>
          ))}
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party & Main Details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party Details</h2>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Party</Label>
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose party" />
              </SelectTrigger>
              <SelectContent>
                {parties.map((c) => (
                  <SelectItem key={c.partyId} value={String(c.partyId)}>
                    {c.partyName} {c.gstNo ? `(${c.gstNo})` : ""}
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
            <Label className="text-xs font-semibold uppercase text-foreground">Invoice No.</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-1020" className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Voucher Date</Label>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Voucher descriptions" className="h-9" />
          </div>
        </div>

        {/* Logistics details */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Dispatch</h2>

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

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">LR No.</Label>
              <Input value={lrNo} onChange={(e) => setLrNo(e.target.value)} placeholder="Lorry Receipt No." className="h-9" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">LR Date</Label>
                <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">Transport</Label>
                <Input value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="Transport Service" className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Vehicle No.</Label>
              <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. GJ-05-XX-XXXX" className="h-9" />
            </div>
          </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Sales Items & Fabric details</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Input PCS count, main meters (Qty), and fold percentage.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLine} className="h-8 text-xs font-semibold uppercase">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1250px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pr-4 w-[16%]">Item</th>
                <th className="py-2 px-3 w-[5%] text-right">Fold</th>
                <th className="py-2 px-3 w-[5%] text-right">PCS</th>
                <th className="py-2 px-3 w-[7%] text-right">Quantity</th>
                <th className="py-2 px-3 w-[7%] text-right">Rate</th>
                <th className="py-2 px-3 w-[9%]">GST Rate</th>
                <th className="py-2 px-3 w-[8%] text-right">Amount</th>
                <th className="py-2 px-3 w-[8%] text-right">Net Amount</th>
                <th className="py-2 px-3 w-[7%] text-right">CGST</th>
                <th className="py-2 px-3 w-[7%] text-right">SGST</th>
                <th className="py-2 px-3 w-[7%] text-right">IGST</th>
                <th className="py-2 px-3 w-[10%] text-right">Net Amt</th>
                <th className="py-2 pl-4 w-[4%]"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, index) => {
                const totals = lineTotals[index];
                return (
                  <tr key={line.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <Select value={line.inventoryId} onValueChange={(val) => updateLine(line.id, "inventoryId", val)}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((p) => (
                            <SelectItem key={p.inventoryId} value={String(p.inventoryId)}>
                              {p.inventoryCode} — {p.inventoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        value={line.fold}
                        onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                        className="h-9 text-right"
                        placeholder="100"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        value={line.pcs}
                        onChange={(e) => updateLine(line.id, "pcs", e.target.value)}
                        className="h-9 text-right"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        className="h-9 text-right font-medium"
                      />
                    </td>

                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) => updateLine(line.id, "rate", e.target.value)}
                        className="h-9 text-right font-semibold"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Select value={line.gstRateId} onValueChange={(val) => updateLine(line.id, "gstRateId", val)}>
                        <SelectTrigger className="h-9 w-full">
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
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      ₹{totals?.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-foreground">
                      ₹{totals?.netAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      ₹{totals?.cgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      ₹{totals?.sgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                      ₹{totals?.igst.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-foreground">
                      ₹{totals?.net.toFixed(2)}
                    </td>
                    <td className="py-3 pl-4 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lineItems.length === 1}
                        className="text-danger hover:bg-danger/10 hover:text-danger h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={saving || !canCreate} className="h-10 font-bold uppercase px-8">
          {saving ? "Saving Voucher..." : "Save Sales Invoice"}
        </Button>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}

      {/* Past Vouchers List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sales History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Last 50 posted sales vouchers</p>
          </div>
        </div>

        {pastVouchers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No sales vouchers yet. Create your first sale above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Voucher No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Net Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pastVouchers.map((v) => (
                  <tr key={v.voucherId} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{v.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.voucherDate}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{v.party?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground italic text-xs max-w-[160px] truncate">{v.remarks || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmt(v.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{fmt(v.taxAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{fmt(v.netAmount)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={v.status === "posted" ? "secondary" : "outline"} className="text-xs uppercase font-semibold">
                        {v.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" title="Preview Invoice" onClick={() => openReprint(v)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
