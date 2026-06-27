"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Printer } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";

interface SupplierOption {
  supplierId: number;
  supplierName: string;
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
  quantity: string; // meters / quantity
  fold: string; // fold percentage (default 100)
  rate: string;
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
  gstRateId: "",
});

export default function PurchaseClient({
  company,
  suppliers,
  inventory,
  ledgers,
  taxRates,
  canCreate,
}: {
  company: { companyName: string; gstNo?: string | null; address?: string | null; companyType?: string };
  suppliers: SupplierOption[];
  inventory: InventoryOption[];
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
}) {
  const isTextile = company.companyType === "textiles";

  const [purchaseType, setPurchaseType] = useState<"grey" | "finished" | "consumable" | "other">("grey");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Textile-specific logistics fields
  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");
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
    const supplier = suppliers.find((s) => String(s.supplierId) === selectedSupplier);
    const supplierGst = supplier?.gstNo || "";
    if (!companyGst || !supplierGst) return false;
    return companyGst.slice(0, 2) !== supplierGst.slice(0, 2);
  }, [company, selectedSupplier, suppliers]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = isTextile ? (Number(line.fold) || 100) : 100;
      const gstRatePercent = Number(line.gstRateId ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)?.taxPercent : 0) || 0;
      
      // Fold calculation: qty * rate * fold / 100
      const amount = Math.round((qty * rate * fold / 100) * 100) / 100;
      const totalTax = Math.round((amount * gstRatePercent) / 100 * 100) / 100;
      
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterstate) {
        igst = totalTax;
      } else {
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax - cgst) * 100) / 100;
      }

      return { amount, cgst, sgst, igst, totalTax, net: amount + totalTax };
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
    if (!selectedSupplier || !voucherNo) {
      setMessage("Select supplier and enter voucher number.");
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId && Number(line.quantity) >= 0 && Number(line.rate) >= 0 && line.ledgerId);
    if (validLines.length === 0) {
      setMessage("Add at least one line item with item, ledger, quantity, and rate.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "purchase",
        voucherNo,
        voucherDate,
        partyId: Number(selectedSupplier),
        remarks: remarks || `Purchase - ${purchaseType.toUpperCase()}`,
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
          ledgerId: Number(line.ledgerId),
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
        throw new Error(json.error || "Failed to save purchase voucher.");
      }

      setMessage("Purchase voucher created successfully.");
      setVoucherNo("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setLineItems([EMPTY_LINE()]);

      // Print preview setup
      const supplier = suppliers.find((s) => String(s.supplierId) === selectedSupplier);
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
          name: supplier?.supplierName || "Supplier",
          gstNo: supplier?.gstNo,
          address: supplier?.address,
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
    <div className="space-y-6 max-w-7xl mx-auto p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Purchase Invoice Entry</h1>
          <p className="text-sm text-muted-foreground">Record textile purchases, fold calculations, and logistics details.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["grey", "finished", "consumable", "other"] as const).map((type) => (
            <Button
              key={type}
              variant={purchaseType === type ? "default" : "outline"}
              onClick={() => setPurchaseType(type)}
              className="text-xs uppercase font-semibold h-8"
            >
              {type} Purchase
            </Button>
          ))}
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Supplier & Main Details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Party Details</h2>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.supplierId} value={String(s.supplierId)}>
                    {s.supplierName} {s.gstNo ? `(${s.gstNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isTextile && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">Broker</Label>
                <Input value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="Broker Name" className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">Haste (Delivery Agent)</Label>
                <Input value={haste} onChange={(e) => setHaste(e.target.value)} placeholder="Haste / Courier" className="h-9" />
              </div>
            </>
          )}
        </div>

        {/* Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Document Details</h2>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">Invoice / Sr No.</Label>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="e.g. INV-1020" className="h-9" />
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
        {isTextile && (
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
        )}
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
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pr-4 w-[25%]">Item</th>
                <th className="py-2 px-3 w-[20%]">Expense Ledger</th>
                <th className="py-2 px-3 w-[8%] text-right">PCS</th>
                <th className="py-2 px-3 w-[10%] text-right">{isTextile ? "Quantity (Mtr)" : "Quantity"}</th>
                {isTextile && <th className="py-2 px-3 w-[8%] text-right">Fold %</th>}
                <th className="py-2 px-3 w-[10%] text-right">Rate</th>
                <th className="py-2 px-3 w-[10%]">GST Rate</th>
                <th className="py-2 px-3 w-[12%] text-right">Net Taxable</th>
                <th className="py-2 pl-4 w-[5%]"></th>
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
                      <Select value={line.ledgerId} onValueChange={(val) => updateLine(line.id, "ledgerId", val)}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select Ledger" />
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
                    {isTextile && (
                      <td className="py-3 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          value={line.fold}
                          onChange={(e) => updateLine(line.id, "fold", e.target.value)}
                          className="h-9 text-right text-muted-foreground"
                        />
                      </td>
                    )}
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
                    <td className="py-3 px-3 text-right font-bold text-foreground">
                      ₹{totals?.amount.toFixed(2)}
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

      {/* Invoice Summary and Tax Details */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-3 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">GST Tax Breakdown</h2>
          
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">CGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.cgst.toFixed(2)}</div>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">SGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.sgst.toFixed(2)}</div>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">IGST Total</div>
              <div className="mt-1 text-base font-bold text-foreground">₹{grandTotals.igst.toFixed(2)}</div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic text-center">
            * Real-time tax splits determined automatically based on state settings.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Value:</span>
              <span className="font-semibold">₹{grandTotals.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total GST:</span>
              <span className="font-semibold text-warning">₹{grandTotals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
              <span>Grand Total:</span>
              <span className="text-primary">₹{grandTotals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSubmit} disabled={saving || !canCreate} className="w-full h-10 font-bold uppercase">
              {saving ? "Saving Voucher..." : "Save Invoice"}
            </Button>
          </div>
        </div>
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
    </div>
  );
}
