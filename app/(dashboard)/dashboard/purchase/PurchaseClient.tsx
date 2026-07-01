"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Printer } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";

interface CompanyOption {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  address: string | null;
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

interface LineItem {
  id: string;
  inventoryId: string;
  hsnCode: string;
  pcs: string;
  quantity: string; // meters / quantity
  fold: string; // fold percentage (default 100)
  rate: string;
  gstRateId: string;
  cgst: string;
  sgst: string;
  igst: string;
  unitType: "pcs" | "meter";
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
  cgst: "",
  sgst: "",
  igst: "",
  unitType: "meter",
});


export default function PurchaseClient({
  company,
  companies,
  inventory,
  taxRates,
  brokersHaste,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null; companyType?: string };
  companies: CompanyOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
}) {
  const router = useRouter();


  // Dialog States for inline creation
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({ companyName: "", gstNo: "", address: "", phone: "", email: "" });
  const [partySaving, setPartySaving] = useState(false);

  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);

  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [showHasteDialog, setShowHasteDialog] = useState(false);

  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  async function handleCreateParty() {
    if (!partyForm.companyName) return;
    setPartySaving(true);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...partyForm, openingBalance: 0 }),
      });
      if (res.ok) {
        setShowPartyModal(false);
        router.push("/dashboard/parties");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPartySaving(false);
    }
  }


  const purchaseType = "purchase";
  const [selectedCompany, setSelectedCompany] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [goodsName, setGoodsName] = useState("");
  
  // Textile-specific logistics fields
  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
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
 
  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const companyGst = company?.gstNo || "";
    const subCompany = companies.find((s) => String(s.companyId) === selectedCompany);
    const subCompanyGst = subCompany?.gstNo || "";
    if (!companyGst || !subCompanyGst) return false;
    return companyGst.slice(0, 2) !== subCompanyGst.slice(0, 2);
  }, [company, selectedCompany, companies]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      
      // Amount formula: if unitType is 'pcs', then pcs * rate. If 'meter', then qty * rate * fold / 100.
      const multiplier = line.unitType === "pcs" ? pcs : (qty * fold / 100);
      const amount = Math.round((multiplier * rate) * 100) / 100;
      const totalTax = Math.round((amount * gstRatePercent) / 100 * 100) / 100;
      
      let defaultCgst = 0;
      let defaultSgst = 0;
      let defaultIgst = 0;

      if (isInterstate) {
        defaultIgst = totalTax;
      } else {
        defaultCgst = Math.round((totalTax / 2) * 100) / 100;
        defaultSgst = Math.round((totalTax - defaultCgst) * 100) / 100;
      }

      const cgst = line.cgst !== "" ? (Number(line.cgst) || 0) : defaultCgst;
      const sgst = line.sgst !== "" ? (Number(line.sgst) || 0) : defaultSgst;
      const igst = line.igst !== "" ? (Number(line.igst) || 0) : defaultIgst;

      const totalTaxVal = cgst + sgst + igst;

      return { amount, cgst, sgst, igst, totalTax: totalTaxVal, net: amount + totalTaxVal };
    });
  }, [lineItems, taxRates, isInterstate]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      { amount: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 }
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
            hsnCode: prod?.inventoryCode || "", // Or hsn code
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
    if (!selectedCompany || !voucherNo) {
      setMessage("Select name and enter voucher number.");
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
        voucherType: "purchase",
        voucherNo,
        voucherDate,
        invoiceNo,
        invoiceDate: invoiceDate || null,
        goodsName,
        partyId: Number(selectedCompany),
        remarks: remarks || "Purchase",
        broker,
        haste,
        lrNo,
        lrDate: lrDate || null,
        transport,
        vehicleNo,
        personName,
        printRate: true,
        printAmount: true,
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryId: Number(line.inventoryId),
            hsnCode: line.hsnCode,
            pcs: Number(line.pcs || 0),
            quantity: Number(line.quantity),
            fold: Number(line.fold || 100),
            rate: Number(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals?.cgst || 0,
            sgst: totals?.sgst || 0,
            igst: totals?.igst || 0,
            jobRateType: line.unitType,
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
        throw new Error(json.error || "Failed to save purchase voucher.");
      }

      setMessage("Purchase voucher created successfully.");
      setVoucherNo("");
      setInvoiceNo("");
      setGoodsName("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLineItems([EMPTY_LINE()]);

      // Print preview setup
      const subCompany = companies.find((s) => String(s.companyId) === selectedCompany);
      setPrintVoucher({
        voucher: {
          voucherNo: body.voucherNo,
          voucherDate: body.voucherDate,
          voucherType: "purchase",
          remarks: body.remarks,
          totalAmount: grandTotals.amount,
          taxAmount: grandTotals.tax,
          netAmount: grandTotals.total,
        },
        party: {
          name: subCompany?.companyName || "Name",
          gstNo: subCompany?.gstNo,
          address: subCompany?.address,
        },
        lines: validLines.map((line) => {
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
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Purchase Invoice Entry</h1>
          <p className="text-sm text-muted-foreground">Record textile purchases, fold calculations, and logistics details.</p>
        </div>

      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Company & Main Details */}
        {/* Party & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party & Document Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Party Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-foreground">Name</Label>
                <button type="button" onClick={() => setShowPartyModal(true)} className="text-[10px] font-bold text-primary hover:underline uppercase">+ New Party</button>
              </div>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose name" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((s) => (
                    <SelectItem key={s.companyId} value={String(s.companyId)}>
                      {s.companyName} {s.gstNo ? `(${s.gstNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Remarks</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Voucher descriptions" className="h-9" />
            </div>

            {/* Voucher / Sr No & Voucher Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Voucher / Sr No.</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. SR-1001" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Voucher Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="h-9" />
            </div>

            {/* Invoice Number & Invoice Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Invoice Number</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-2025" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-9" />
            </div>

            {/* Name of Goods Purchased */}
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold uppercase text-foreground">Name of Goods Purchased</Label>
              <Input value={goodsName} onChange={(e) => setGoodsName(e.target.value)} placeholder="e.g. Cotton fabric, Polyester yarn, Chemicals" className="h-9" />
            </div>

            {/* Broker & Haste */}
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
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Logistics & Shipping</h2>

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
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Purchase Items & Fabric details</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Input PCS count, main meters (Qty), and fold percentage.</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLine} className="h-8 text-xs font-semibold uppercase">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Line Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pr-4 w-[20%]">Item</th>
                <th className="py-2 px-3 w-[12%]">HSN Code</th>
                <th className="py-2 px-3 w-[6%] text-right">PCS</th>
                <th className="py-2 px-3 w-[8%] text-right">Meter</th>
                <th className="py-2 px-3 w-[8%]">Unit</th>
                <th className="py-2 px-3 w-[8%] text-right">Rate</th>
                <th className="py-2 px-3 w-[9%] text-right">Taxable</th>
                <th className="py-2 px-3 w-[8%]">GST Rate</th>
                <th className="py-2 px-3 w-[7%] text-right">CGST</th>
                <th className="py-2 px-3 w-[7%] text-right">SGST</th>
                <th className="py-2 px-3 w-[7%] text-right">IGST</th>
                <th className="py-2 px-3 w-[9%] text-right">Net Amt</th>
                <th className="py-2 pl-4 w-[3%]"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, index) => {
                const totals = lineTotals[index];
                return (
                  <tr key={line.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <div className="space-y-1">
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
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => router.push("/dashboard/inventory")}
                            className="text-[9px] font-bold text-primary hover:underline uppercase"
                          >
                            + New Item
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        value={line.hsnCode}
                        onChange={(e) => updateLine(line.id, "hsnCode", e.target.value)}
                        className="h-9 w-full"
                        placeholder="HSN Code"
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
                      <Select value={line.unitType} onValueChange={(val) => updateLine(line.id, "unitType", val as any)}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meter">Meter</SelectItem>
                          <SelectItem value="pcs">Pcs</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <td className="py-3 px-3 text-right font-semibold text-foreground">
                      ₹{totals?.amount.toFixed(2)}
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
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={totals?.cgst.toFixed(2)}
                        value={line.cgst || ""}
                        onChange={(e) => updateLine(line.id, "cgst", e.target.value)}
                        className="h-9 text-right font-medium w-20 ml-auto"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={totals?.sgst.toFixed(2)}
                        value={line.sgst || ""}
                        onChange={(e) => updateLine(line.id, "sgst", e.target.value)}
                        className="h-9 text-right font-medium w-20 ml-auto"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={totals?.igst.toFixed(2)}
                        value={line.igst || ""}
                        onChange={(e) => updateLine(line.id, "igst", e.target.value)}
                        className="h-9 text-right font-medium w-20 ml-auto"
                      />
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

      {/* Save Invoice Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSubmit} disabled={saving || !canCreate} className="h-10 px-8 font-bold uppercase">
          {saving ? "Saving Voucher..." : "Save Invoice"}
        </Button>
      </div>

      {message && <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">{message}</div>}

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

      {/* Modals for inline creation */}
      <Dialog open={showPartyModal} onOpenChange={setShowPartyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">New Party / Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Name</Label>
              <Input
                placeholder="e.g. Acme Fabrics"
                value={partyForm.companyName}
                onChange={(e) => setPartyForm({ ...partyForm, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">GSTIN</Label>
              <Input
                placeholder="24XXXXX0000X1ZX"
                value={partyForm.gstNo}
                onChange={(e) => setPartyForm({ ...partyForm, gstNo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-foreground">Address</Label>
              <Input
                placeholder="Address Details"
                value={partyForm.address}
                onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPartyModal(false)}>Cancel</Button>
            <Button onClick={handleCreateParty} disabled={partySaving || !partyForm.companyName}>
              {partySaving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
