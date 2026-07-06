"use client";
import { getLocalTodayString } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";
import MillFormDrawer from "@/components/MillFormDrawer";
import PieceMetersDialog from "@/components/PieceMetersDialog";

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
  pieceMeters?: string[] | null;
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
  pieceMeters?: string[];
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
  company: {
    companyName: string;
    gstNo?: string | null;
    address?: string | null;
  };
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
  const [voucherDate, setVoucherDate] = useState(
    getLocalTodayString(),
  );

  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [showHasteDialog, setShowHasteDialog] = useState(false);
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState(getLocalTodayString());
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [personName, setPersonName] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [activePieceLineId, setActivePieceLineId] = useState<string | null>(
    null,
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    hsnCode: string;
    fold: string;
    returnPcs: string;
    returnQty: string;
    rate: string;
  }>({
    hsnCode: "",
    fold: "",
    returnPcs: "",
    returnQty: "",
    rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  type ExtraCharge = {
    id: string;
    label: string;
    value: string;
    type: "percentage" | "value";
  };
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  function updateExtraCharge(
    id: string,
    field: keyof ExtraCharge,
    value: string,
  ) {
    setExtraCharges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=mill_inward");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next mill inward voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

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

    const matchedItems = outwardItems.filter(
      (item) => item.voucherId === Number(selectedVoucherId),
    );
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
      pieceMeters: item.pieceMeters || [],
    }));

    setLineItems(itemsMapped);

    // Auto-fill metadata if available
    const parentVoucher = outwardVouchers.find(
      (v) => v.voucherId === Number(selectedVoucherId),
    );
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
      const amount = Math.round(unit * rate * 100) / 100;
      const netAmount = Math.round(((unit * rate * fold) / 100) * 100) / 100;

      const gstRatePercent =
        Number(
          line.gstRateId
            ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)
                ?.taxPercent
            : 0,
        ) || 0;
      const totalTax =
        Math.round(((netAmount * gstRatePercent) / 100) * 100) / 100;

      // Shortage calculation (outward - inward)
      const shortageQty = Math.max(0, line.outwardQuantity - qty);
      const shortagePcs = Math.max(0, line.outwardPcs - pcs);
      const shortagePercent =
        line.outwardQuantity > 0
          ? Math.round((shortageQty / line.outwardQuantity) * 100 * 100) / 100
          : 0;

      return {
        amount,
        netAmount,
        totalTax,
        net: netAmount + totalTax,
        shortageQty,
        shortagePcs,
        shortagePercent,
      };
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
      { amount: 0, netAmount: 0, tax: 0, total: 0 },
    );
  }, [lineTotals]);

  const totalExtraCharges = useMemo(() => {
    return extraCharges.reduce((sum, c) => {
      if (!c.value) return sum;
      if (c.type === "percentage")
        return sum + (grandTotals.total * Number(c.value)) / 100;
      return sum + Number(c.value);
    }, 0);
  }, [extraCharges, grandTotals.total]);

  const finalGrandTotal = useMemo(() => {
    return grandTotals.total + totalExtraCharges;
  }, [grandTotals.total, totalExtraCharges]);

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
      }),
    );
  }

  function handleSavePieceMeters(meters: string[]) {
    if (!activePieceLineId) return;
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== activePieceLineId) return item;
        let pcs = 0;
        let totalQty = 0;
        for (const m of meters) {
          if (m.includes("x")) {
            const [pStr, qStr] = m.split("x");
            const p = parseInt(pStr) || 0;
            const q = parseFloat(qStr) || 0;
            pcs += p;
            totalQty += p * q;
          } else {
            pcs += 1;
            totalQty += parseFloat(m) || 0;
          }
        }
        return {
          ...item,
          pcs: String(pcs),
          quantity: String(totalQty),
          pieceMeters: meters,
        };
      }),
    );
    setActivePieceLineId(null);
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

  function openEditForm(lineId: string) {
    const line = lineItems.find((l) => l.id === lineId);
    if (line) {
      setEditFormData({
        hsnCode: line.hsnCode,
        fold: line.fold,
        returnPcs: line.pcs,
        returnQty: line.quantity,
        rate: line.rate,
      });
      setEditingLineId(lineId);
    }
  }

  function closeEditForm() {
    setEditingLineId(null);
    setEditFormData({
      hsnCode: "",
      fold: "",
      returnPcs: "",
      returnQty: "",
      rate: "",
    });
  }

  function saveEditForm() {
    if (!editingLineId) return;
    updateLine(editingLineId, "hsnCode", editFormData.hsnCode);
    updateLine(editingLineId, "fold", editFormData.fold);
    updateLine(editingLineId, "pcs", editFormData.returnPcs);
    updateLine(editingLineId, "quantity", editFormData.returnQty);
    updateLine(editingLineId, "rate", editFormData.rate);
    closeEditForm();
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (!selectedMill || !voucherNo || !selectedVoucherId) {
      setMessage(
        "Select Mill Party, Outward Lot and enter inward challan number.",
      );
      return;
    }

    const validLines = lineItems.filter((line) => line.inventoryId);
    if (validLines.length === 0) {
      setMessage("Add at least one line item.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const parentVoucher = outwardVouchers.find(
      (v) => v.voucherId === Number(selectedVoucherId),
    );

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
        extraCharges: totalExtraCharges,
        extraChargesData: extraCharges
          .filter((c) => c.value)
          .map(({ id, ...rest }) => rest),
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
            pieceMeters: line.pieceMeters,
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
      fetchNextVoucherNo();
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setSelectedVoucherId("");
      setExtraCharges([]);
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
          netAmount: finalGrandTotal,
          extraCharges: totalExtraCharges,
          extraChargesData: extraCharges
            .filter((c) => c.value)
            .map(({ id, ...rest }) => rest),
        },
        party: {
          name: selectedMillDetails?.millName || "Mill Party",
          gstNo: selectedMillDetails?.gstNo,
          address: selectedMillDetails?.address,
        },
        lines: validLines.map((line) => {
          const prod = inventory.find(
            (p) => String(p.inventoryId) === line.inventoryId,
          );
          const tr = taxRates.find(
            (t) => String(t.taxRateId) === line.gstRateId,
          );
          const qty = Number(line.quantity) || 0;
          const rt = Number(line.rate) || 0;
          const fd = Number(line.fold) || 100;
          const pcsVal = Number(line.pcs) || 0;
          const amt =
            line.jobRateType === "pcs" ? pcsVal * rt : (qty * rt * fd) / 100;
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
      setMessage(
        error instanceof Error ? error.message : "Unable to save voucher.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 container mx-auto p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
            Mill Inward Entry
          </h1>
          <p className="text-sm text-muted-foreground">
            Receive processed fabric/yarn from mills and track lot shortage.
          </p>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Party & Document Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mill Party */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label >
                  Mill Party
                </Label>
                {canCreate && (
                  <Button
                    type="button"
                    onClick={() => setShowMillModal(true)}
                    variant="link" size="sm" className="p-0 h-auto"
                  >
                    + New Mill Party
                  </Button>
                )}
              </div>
              <Select
                value={selectedMill}
                onValueChange={(v) => {
                  setSelectedMill(v);
                  setSelectedVoucherId("");
                }}
              >
                <SelectTrigger>
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

            {/* Outward Lot No / Challan */}
            <div className="space-y-1.5 md:col-span-2">
              <Label >
                Outward Lot No / Challan
              </Label>
              <Select
                value={selectedVoucherId}
                onValueChange={setSelectedVoucherId}
                disabled={!selectedMill}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedMill ? "Select Outward Lot" : "Select Mill first"
                    }
                  />
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

            {/* Voucher No. */}
            <div className="space-y-1.5">
              <Label >
                Voucher No.
              </Label>
              <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-10" />
            </div>

            {/* Inward Date */}
            <div className="space-y-1.5">
              <Label >
                Inward Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5 md:col-span-2">
              <Label >
                Remarks
              </Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Notes"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Logistics & Agent
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label >
                  Broker
                </Label>
                <Button
                  type="button"
                  onClick={() => setShowBrokerDialog(true)}
                  variant="link" size="sm" className="p-0 h-auto"
                >
                  + New Broker
                </Button>
              </div>
              <Select value={broker} onValueChange={setBroker}>
                <SelectTrigger className="w-full">
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
                <Label >
                  Haste (Delivery Agent)
                </Label>
                <Button
                  type="button"
                  onClick={() => setShowHasteDialog(true)}
                  variant="link" size="sm" className="p-0 h-auto"
                >
                  + New Haste
                </Button>
              </div>
              <Select value={haste} onValueChange={setHaste}>
                <SelectTrigger className="w-full">
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
              <Label >
                Vehicle No.
              </Label>
              <Input
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="Vehicle No"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                Person/Driver
              </Label>
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Name"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label >
                LR No.
              </Label>
              <Input
                value={lrNo}
                onChange={(e) => setLrNo(e.target.value)}
                placeholder="LR No"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                LR Date
              </Label>
              <Input
                type="date"
                value={lrDate}
                onChange={(e) => setLrDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Container */}
      {lineItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                Inward Items, Shortage & Matching
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Edit inward PCS/Quantity and view calculated shortage.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={addLine}
              className="h-10 text-xs font-semibold uppercase"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Custom Item
            </Button>
          </div>

          <div className="space-y-4">
            {lineItems.map((line, index) => {
              const totals = lineTotals[index];
              return (
                <div
                  key={line.id}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 relative"
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Item #{index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => openEditForm(line.id)}
                        className="text-primary hover:bg-primary/10 hover:text-primary h-9 px-3 text-xs uppercase font-semibold flex items-center gap-1.5"
                      >
                        <Edit className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => removeLine(line.id)}
                        className="text-danger hover:bg-danger/10 hover:text-danger h-9 px-3 text-xs uppercase font-semibold flex items-center gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" /> Remove Row
                      </Button>
                    </div>
                  </div>

                  {/* Edit Form - shows when edit icon is clicked */}
                  {editingLineId === line.id && (
                    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Edit Inward Details
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={closeEditForm}
                          className="h-7 px-2 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="space-y-1.5">
                          <Label >
                            HSN Code
                          </Label>
                          <Input
                            value={editFormData.hsnCode}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                hsnCode: e.target.value,
                              })
                            }
                            placeholder="HSN Code"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label >
                            Fold %
                          </Label>
                          <Input
                            type="number"
                            value={editFormData.fold}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                fold: e.target.value,
                              })
                            }
                            className="h-9 text-right"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label >
                            Inward PCS
                          </Label>
                          <Input
                            type="number"
                            value={editFormData.returnPcs}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                returnPcs: e.target.value,
                              })
                            }
                            className="h-9 text-right"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label >
                            Inward Qty
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.returnQty}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                returnQty: e.target.value,
                              })
                            }
                            className="h-9 text-right"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label >
                            Rate (₹)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.rate}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                rate: e.target.value,
                              })
                            }
                            className="h-9 text-right"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={saveEditForm}
                          className="h-9 px-4 text-xs font-bold uppercase"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Input Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Select Item */}
                    <div className="md:col-span-4 space-y-1.5">
                      <Label >
                        Select Item
                      </Label>
                      <Select
                        value={line.inventoryId}
                        onValueChange={(v) =>
                          updateLine(line.id, "inventoryId", v)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((p) => (
                            <SelectItem
                              key={p.inventoryId}
                              value={String(p.inventoryId)}
                            >
                              {p.inventoryName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* HSN Code */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label >
                        HSN Code
                      </Label>
                      <Input
                        value={line.hsnCode || ""}
                        onChange={(e) =>
                          updateLine(line.id, "hsnCode", e.target.value)
                        }
                        placeholder="HSN Code"
                        readOnly
                        className="h-10"
                      />
                    </div>

                    {/* Fold % */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label >
                        Fold %
                      </Label>
                      <Input
                        type="number"
                        value={line.fold || ""}
                        onChange={(e) =>
                          updateLine(line.id, "fold", e.target.value)
                        }
                        readOnly
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Inward PCS */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label >
                        Inward PCS
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={line.pcs || ""}
                          onChange={(e) =>
                            updateLine(line.id, "pcs", e.target.value)
                          }
                          readOnly
                          className="h-10 text-right w-full"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 px-3 shrink-0"
                          onClick={() => setActivePieceLineId(line.id)}
                          title="Enter Piece Meters"
                        >
                          ⚙️
                        </Button>
                      </div>
                    </div>

                    {/* Inward Qty */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label >
                        Inward Qty
                      </Label>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        readOnly
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Outward PCS */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Outward PCS
                      </Label>
                      <div className="h-10 flex items-center bg-muted/40 px-3 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground">
                        {line.outwardPcs}
                      </div>
                    </div>

                    {/* Outward Qty */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Outward Qty
                      </Label>
                      <div className="h-10 flex items-center bg-muted/40 px-3 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground">
                        {line.outwardQuantity}
                      </div>
                    </div>

                    {/* Shortage % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Shortage %
                      </Label>
                      <div className="h-10 flex items-center bg-muted/40 px-3 rounded-lg border border-border/50 text-xs font-bold text-destructive">
                        {totals.shortagePercent > 0 ? (
                          <span>{totals.shortagePercent.toFixed(2)}%</span>
                        ) : (
                          <span className="text-success">No Shortage</span>
                        )}
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Rate (₹)
                      </Label>
                      <Input
                        type="number"
                        value={line.rate}
                        onChange={(e) =>
                          updateLine(line.id, "rate", e.target.value)
                        }
                        readOnly
                        className="h-10 text-right"
                      />
                    </div>
                  </div>

                  {/* Calculations Summary Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        Amount
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        ₹{" "}
                        {totals.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        Net Amount
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        ₹{" "}
                        {totals.netAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        GST Tax
                      </span>
                      <span className="font-semibold text-muted-foreground text-sm">
                        ₹{" "}
                        {totals.totalTax.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px] text-primary">
                        Net Total
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        ₹{" "}
                        {totals.net.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
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
                <Label >
                  Print Challan:
                </Label>
                <select
                  value={printRate ? "yes" : "no"}
                  onChange={(e) => setPrintRate(e.target.value === "yes")}
                  className="h-10 rounded border border-border bg-background px-3 py-1 font-semibold uppercase text-xs text-foreground"
                >
                  <option value="yes">Print Rate (Yes)</option>
                  <option value="no">Print Rate (No)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={printAmount ? "yes" : "no"}
                  onChange={(e) => setPrintAmount(e.target.value === "yes")}
                  className="h-10 rounded border border-border bg-background px-3 py-1 font-semibold uppercase text-xs text-foreground"
                >
                  <option value="yes">Print Amount (Yes)</option>
                  <option value="no">Print Amount (No)</option>
                </select>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label >
                  Extra Charges
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExtraCharges((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        label: "",
                        value: "",
                        type: "value",
                      },
                    ])
                  }
                  className="h-7 px-2 text-xs"
                >
                  + Add Charge
                </Button>
              </div>
              {extraCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="grid grid-cols-[1fr_90px_90px_auto] gap-2 items-center"
                >
                  <Input
                    placeholder="Label (e.g. Freight)"
                    value={charge.label}
                    onChange={(e) =>
                      updateExtraCharge(charge.id, "label", e.target.value)
                    }
                    className="h-9"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={charge.value}
                    onChange={(e) =>
                      updateExtraCharge(charge.id, "value", e.target.value)
                    }
                    className="h-9"
                  />
                  <Select
                    value={charge.type}
                    onValueChange={(val) =>
                      updateExtraCharge(charge.id, "type", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="value">₹ Flat</SelectItem>
                      <SelectItem value="percentage">% Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      setExtraCharges((prev) =>
                        prev.filter((c) => c.id !== charge.id),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-right font-mono">
              {extraCharges
                .filter((c) => c.value)
                .map((c) => (
                  <div key={c.id} className="text-xs text-muted-foreground">
                    {c.label || "Extra Charges"}: +₹
                    {(c.type === "percentage"
                      ? (grandTotals.total * Number(c.value)) / 100
                      : Number(c.value)
                    ).toFixed(2)}
                  </div>
                ))}
              <div className="text-muted-foreground">Total Inward Amount:</div>
              <div className="text-lg font-black text-foreground">
                ₹{" "}
                {finalGrandTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold text-destructive uppercase">
          {message}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={saving || lineItems.length === 0}
          className="h-10 text-xs font-bold uppercase tracking-wider px-8 ml-auto"
        >
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
      {(() => {
        const activeLine = lineItems.find((l) => l.id === activePieceLineId);
        return activeLine ? (
          <PieceMetersDialog
            isOpen={!!activePieceLineId}
            onClose={() => setActivePieceLineId(null)}
            pcsCount={parseInt(activeLine.pcs) || 0}
            quantityCount={parseFloat(activeLine.quantity) || 0}
            initialMeters={activeLine.pieceMeters || []}
            onSave={handleSavePieceMeters}
          />
        ) : null;
      })()}
    </div>
  );
}
