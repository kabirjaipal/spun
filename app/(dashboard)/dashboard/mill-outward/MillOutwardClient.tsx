"use client";
import { getLocalTodayString } from "@/lib/utils";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
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

interface LineItem {
  id: string;
  inventoryId: string;
  hsnCode: string;
  pcs: string;
  quantity: string; // meter / quantity
  fold: string; // fold percentage (default 100)
  rate: string; // mill rate
  jobType: string; // e.g. processing, finishing, weaving etc.
  jobRateType: "pcs" | "mtr";
  gstRateId: string;
  pieceMeters?: string[];
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  inventoryId: "",
  hsnCode: "",
  pcs: "0",
  quantity: "0",
  fold: "100",
  rate: "0",
  jobType: "processing",
  jobRateType: "mtr",
  gstRateId: "",
  pieceMeters: [],
});

interface InwardVoucher {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  partyId: number | null;
  lotNo: string | null;
}

interface InwardItem {
  voucherItemId: number;
  voucherId: number;
  inventoryId: number;
  hsnCode: string | null;
  pcs: number;
  quantity: string;
  fold: string;
  rate: string;
  jobType: string | null;
  jobRateType: "pcs" | "mtr" | null;
  gstRateId: number | null;
}

export default function MillOutwardClient({
  company,
  mills,
  inventory,
  taxRates,
  brokersHaste,
  inwardVouchers,
  inwardItems,
  canCreate,
}: {
  company: {
    companyName: string;
    gstNo?: string | null;
    address?: string | null;
    state?: string | null;
    jobPartyType?: string | null;
  };
  mills: MillOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  inwardVouchers: InwardVoucher[];
  inwardItems: InwardItem[];
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
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(
    getLocalTodayString(),
  );
  const [isLrDateCustom, setIsLrDateCustom] = useState(false);

  const handleVoucherDateChange = (val: string) => {
    setVoucherDate(val);
    if (!isLrDateCustom) {
      setLrDate(val);
    }
  };

  const handleLrDateChange = (val: string) => {
    setLrDate(val);
    setIsLrDateCustom(true);
  };

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
  const [lotNo, setLotNo] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [activePieceLineId, setActivePieceLineId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"percentage" | "value">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType2, setDiscountType2] = useState<"percentage" | "value">("percentage");
  const [discountValue2, setDiscountValue2] = useState("");
  const [selectedInwardVoucherId, setSelectedInwardVoucherId] = useState("");

  type ExtraCharge = {
    id: string;
    label: string;
    value: string;
    type: "percentage" | "value";
    effect: "add" | "less";
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
      const res = await fetch("/api/vouchers/next-number?type=mill_outward");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next mill outward voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  const selectedMillDetails = useMemo(() => {
    return localMills.find((m) => String(m.millId) === selectedMill) || null;
  }, [selectedMill, localMills]);

  const defaultJobTypes = ["dyeing", "printing", "weaving", "stitching", "embroidery"];
  const uniqueJobTypes = useMemo(() => {
    const types = new Set(defaultJobTypes);
    inwardItems?.forEach((item) => {
      if (item.jobType) types.add(item.jobType);
    });
    lineItems.forEach((item) => {
      if (item.jobType) types.add(item.jobType);
    });
    return Array.from(types);
  }, [inwardItems, lineItems]);

  const partyInwardVouchers = useMemo(() => {
    if (!selectedMill) return [];
    return inwardVouchers.filter((v) => String(v.partyId) === selectedMill);
  }, [selectedMill, inwardVouchers]);

  useEffect(() => {
    if (company.jobPartyType !== "process_house" || !selectedInwardVoucherId) {
      return;
    }
    const parentVoucher = inwardVouchers.find(
      (v) => v.voucherId === Number(selectedInwardVoucherId),
    );
    const parentItems = inwardItems.filter(
      (item) => item.voucherId === Number(selectedInwardVoucherId),
    );
    setLineItems(
      parentItems.map((item) => ({
        id: crypto.randomUUID(),
        inventoryId: String(item.inventoryId),
        hsnCode: item.hsnCode || "",
        pcs: String(item.pcs),
        quantity: String(item.quantity),
        fold: String(item.fold || 100),
        rate: String(item.rate || 0),
        jobType: item.jobType || "processing",
        jobRateType: (item.jobRateType as any) || "mtr",
        gstRateId: item.gstRateId ? String(item.gstRateId) : "",
      })),
    );
    if (parentVoucher) {
      setRemarks(`Outward against MI Lot: ${parentVoucher.lotNo || ""}`);
    }
  }, [selectedInwardVoucherId, inwardItems, inwardVouchers, company.jobPartyType]);

  const isInterstate = useMemo(() => {
    const mill = localMills.find((m) => String(m.millId) === selectedMill);
    if (!mill) return false;
    const companyGst = company?.gstNo || "";
    const millGst = mill?.gstNo || "";
    if (companyGst && millGst) {
      return companyGst.trim().slice(0, 2) !== millGst.trim().slice(0, 2);
    }
    return false;
  }, [company, selectedMill, localMills]);

  const rawTotal = useMemo(() => {
    return lineItems.reduce((sum, line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const fold = Number(line.fold) || 100;
      const rate = Number(line.rate) || 0;
      const unit = line.jobRateType === "pcs" ? pcs : qty;
      const netAmount = Math.round(((unit * rate * fold) / 100) * 100) / 100;
      return sum + netAmount;
    }, 0);
  }, [lineItems]);

  const totalExtraCharges = useMemo(() => {
    return extraCharges.reduce((sum, c) => {
      if (!c.value) return sum;
      const isLess = c.effect === "less";
      const amt = c.type === "percentage"
        ? (rawTotal * Number(c.value)) / 100
        : Number(c.value);
      return isLess ? sum - amt : sum + amt;
    }, 0);
  }, [extraCharges, rawTotal]);

  const lineTotals = useMemo(() => {
    return lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;

      const unit = line.jobRateType === "pcs" ? pcs : qty;
      const amount = Math.round(unit * rate * 100) / 100;
      const netAmount = Math.round(((unit * rate * fold) / 100) * 100) / 100;

      // Allocate extra charges proportionally
      const allocatedExtraCharge = rawTotal > 0
        ? (netAmount / rawTotal) * totalExtraCharges
        : totalExtraCharges / (lineItems.length || 1);

      const taxableAmount = Math.max(0, netAmount + allocatedExtraCharge);

      const gstRatePercent =
        Number(
          line.gstRateId
            ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)
              ?.taxPercent
            : 0,
        ) || 0;
      const totalTax =
        Math.round(((taxableAmount * gstRatePercent) / 100) * 100) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      if (isInterstate) {
        igst = totalTax;
      } else {
        cgst = Math.round((totalTax / 2) * 100) / 100;
        sgst = Math.round((totalTax - cgst) * 100) / 100;
      }

      return {
        amount,
        netAmount,
        taxableAmount,
        totalTax,
        cgst,
        sgst,
        igst,
        net: taxableAmount + totalTax,
      };
    });
  }, [lineItems, taxRates, totalExtraCharges, rawTotal, isInterstate]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        netAmount: acc.netAmount + item.netAmount,
        taxableAmount: acc.taxableAmount + item.taxableAmount,
        tax: acc.tax + item.totalTax,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        total: acc.total + item.net,
      }),
      { amount: 0, netAmount: 0, taxableAmount: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
    );
  }, [lineTotals]);

  const calculatePreTaxDiscount = (val: string, type: "percentage" | "value", base: number) => {
    if (!val) return 0;
    if (type === "percentage") return (base * Number(val)) / 100;
    return Number(val);
  };

  const discount1Amt = useMemo(() => {
    return calculatePreTaxDiscount(discountValue, discountType, grandTotals.total);
  }, [discountValue, discountType, grandTotals.total]);

  const discount2Amt = useMemo(() => {
    return calculatePreTaxDiscount(discountValue2, discountType2, grandTotals.total);
  }, [discountValue2, discountType2, grandTotals.total]);

  const finalGrandTotal = useMemo(() => {
    return Math.max(0, grandTotals.total - (discount1Amt + discount2Amt));
  }, [grandTotals.total, discount1Amt, discount2Amt]);

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
    setLineItems((items) => [...items, EMPTY_LINE()]);
  }

  const removeLine = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  async function handleSubmit() {
    if (!canCreate) return;
    if (company.jobPartyType === "process_house") {
      if (!selectedMill || !voucherNo || !selectedInwardVoucherId) {
        setMessage("Select Mill Party, Inward Voucher and enter voucher number.");
        return;
      }
    } else {
      if (!selectedMill || !voucherNo) {
        setMessage("Select Mill Party and enter voucher number.");
        return;
      }
    }

    const validLines = lineItems.filter((line) => line.inventoryId);
    if (validLines.length === 0) {
      setMessage("Add at least one item.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const parentVoucher = inwardVouchers.find(
      (v) => v.voucherId === Number(selectedInwardVoucherId),
    );

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
        lotNo: company.jobPartyType === "process_house" ? parentVoucher?.lotNo || null : lotNo || null,
        printRate,
        printAmount,
        parentVoucherId: company.jobPartyType === "process_house" ? Number(selectedInwardVoucherId) : null,
        discountType: discountValue ? discountType : null,
        discountValue: discountValue ? Number(discountValue) : null,
        discountType2: discountValue2 ? discountType2 : null,
        discountValue2: discountValue2 ? Number(discountValue2) : null,
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
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            taxableAmount: totals.taxableAmount,
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
        throw new Error(json.error || "Failed to save Mill Outward voucher.");
      }

      setMessage("Mill Outward Challan created successfully.");
      fetchNextVoucherNo();
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setIsLrDateCustom(false);
      setTransport("");
      setLotNo("");
      setSelectedInwardVoucherId("");
      setDiscountValue("");
      setDiscountValue2("");
      setExtraCharges([]);
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
    <div className="space-y-6 p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
            Mill Outward Entry
          </h1>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Mill Details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Party Details
          </h2>

          <div className="space-y-1.5">
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
            <Select value={selectedMill} onValueChange={setSelectedMill}>
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

        {/* Voucher Info */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Document Details
          </h2>

          <div className="space-y-1.5">
            <Label >
              Voucher No.
            </Label>
            <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-9" />
          </div>

          {/* Lot No / Inward Voucher selection */}
          {company.jobPartyType === "process_house" ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label>
                Against Inward Voucher No *
              </Label>
              <Select
                value={selectedInwardVoucherId}
                onValueChange={setSelectedInwardVoucherId}
                disabled={!selectedMill}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      selectedMill
                        ? "Select Inward Voucher"
                        : "Select Mill first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {partyInwardVouchers.map((v) => (
                    <SelectItem key={v.voucherId} value={String(v.voucherId)}>
                      MI: {v.voucherNo} {v.lotNo ? `(Lot No: ${v.lotNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                Lot No. (Optional)
              </Label>
              <Input
                value={lotNo}
                onChange={(e) => setLotNo(e.target.value)}
                placeholder="e.g. LOT-450"
                className="h-10"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label >
                Challan Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => handleVoucherDateChange(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                Remarks
              </Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Notes"
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Logistics & Shipping
          </h2>

          <div className="space-y-1.5">
            <Label >
              Vehicle No.
            </Label>
            <Input
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              placeholder="e.g. GJ-05-XX-XXXX"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label >
                Driver/Person Name
              </Label>
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Name"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                Transport
              </Label>
              <Input
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                placeholder="Transport Service"
                className="h-9"
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
                placeholder="LR Number"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                LR Date
              </Label>
              <Input
                type="date"
                value={lrDate}
                onChange={(e) => handleLrDateChange(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Mill Outward Items & Specifications
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Input inventory, PCS, meters (Qty), fold, processing types, and
              rates.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={addLine}
            className="h-9 text-xs font-semibold uppercase"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-border text-xs font-bold uppercase text-muted-foreground">
                <th className="py-2 pr-2 w-[20%]">Item</th>
                <th className="py-2 px-2 w-[8%]">HSN Code</th>
                <th className="py-2 px-2 w-[6%] text-center">Fold%</th>
                <th className="py-2 px-2 w-[8%] text-center">PCS</th>
                <th className="py-2 px-2 w-[8%] text-center">Meters</th>
                <th className="py-2 px-2 w-[10%]">Process Type</th>
                <th className="py-2 px-2 w-[8%]">Per</th>
                <th className="py-2 px-2 w-[8%]">Rate</th>
                <th className="py-2 px-2 w-[8%] text-right">Amount</th>
                <th className="py-2 px-2 w-[8%] text-right">Net Amount</th>
                <th className="py-2 pl-2 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {lineItems.map((line, index) => {
                const totals = lineTotals[index];
                return (
                  <tr key={line.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-2">
                      <Select
                        value={line.inventoryId}
                        onValueChange={(v) =>
                          updateLine(line.id, "inventoryId", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory.map((p) => (
                            <SelectItem
                              key={p.inventoryId}
                              value={String(p.inventoryId)}
                            >
                              {p.inventoryName} ({p.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        value={line.hsnCode}
                        onChange={(e) =>
                          updateLine(line.id, "hsnCode", e.target.value)
                        }
                        placeholder="HSN Code"
                        className="h-9 font-mono text-xs"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.fold}
                        onChange={(e) =>
                          updateLine(line.id, "fold", e.target.value)
                        }
                        className="h-9 font-mono text-xs text-center"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={line.pcs}
                          onChange={(e) =>
                            updateLine(line.id, "pcs", e.target.value)
                          }
                          readOnly={
                            !!(line.pieceMeters && line.pieceMeters.length > 0)
                          }
                          className={`h-9 font-mono text-xs text-center w-full ${line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 px-2 shrink-0 text-[10px]"
                          onClick={() => setActivePieceLineId(line.id)}
                          title="Enter Piece Meters"
                        >
                          ⚙️
                        </Button>
                      </div>
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        readOnly={
                          !!(line.pieceMeters && line.pieceMeters.length > 0)
                        }
                        className={`h-9 font-mono text-xs text-center ${line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}`}
                      />
                    </td>

                    <td className="py-3 px-2">
                      <Input
                        value={line.jobType}
                        onChange={(e) => updateLine(line.id, "jobType", e.target.value)}
                        placeholder="e.g. processing"
                        list={`job-types-${line.id}`}
                        className="h-9 text-xs"
                      />
                      <datalist id={`job-types-${line.id}`}>
                        {uniqueJobTypes.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </td>

                    <td className="py-3 px-2">
                      <Select
                        value={line.jobRateType}
                        onValueChange={(v) =>
                          updateLine(line.id, "jobRateType", v as any)
                        }
                      >
                        <SelectTrigger>
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
                        onChange={(e) =>
                          updateLine(line.id, "rate", e.target.value)
                        }
                        className="h-9 font-mono text-xs text-right"
                      />
                    </td>

                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                      ₹{" "}
                      {totals.amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-bold text-foreground">
                      ₹{" "}
                      {totals.netAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td className="py-3 pl-2 text-center">
                      <Button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={lineItems.length === 1}
                        variant="ghost" size="icon"
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

        {/* Summary Footer */}
        <div className="grid gap-6 md:grid-cols-3 border-t border-border pt-4">
          {/* Column 1: Print Controls */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm text-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              Print Controls
            </h2>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label>Print Rate</Label>
                <select
                  value={printRate ? "yes" : "no"}
                  onChange={(e) => setPrintRate(e.target.value === "yes")}
                  className="h-10 rounded border border-border bg-background px-3 py-1 font-semibold uppercase text-xs text-foreground"
                >
                  <option value="yes">Print Rate (Yes)</option>
                  <option value="no">Print Rate (No)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Print Amount</Label>
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
          </div>

          {/* Column 2: Apply Discounts */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              Apply Discounts (Post-Tax)
            </h2>
            {/* Discount 1 */}
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/40">
              <div className="space-y-1.5">
                <Label>Discount 1 Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={discountType}
                  onValueChange={(val) => setDiscountType(val as any)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="value">Flat Value (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Discount 2 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount 2 Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={discountValue2}
                  onChange={(e) => setDiscountValue2(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={discountType2}
                  onValueChange={(val) => setDiscountType2(val as any)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="value">Flat Value (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Column 3: Extra Charges & Totals Display */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Extra Charges (Pre-GST)
              </h2>
              <div className="flex items-center gap-2">
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
                        effect: "add",
                      },
                    ])
                  }
                  className="h-7 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                >
                  + Add
                  </Button>
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
                        effect: "less",
                      },
                    ])
                  }
                  className="h-7 px-2 text-xs text-danger hover:text-danger hover:bg-danger/10"
                >
                  - Less
                </Button>
              </div>
            </div>

            <div className="max-h-[180px] overflow-y-auto space-y-2">
              {extraCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="grid grid-cols-[1fr_80px_70px_70px_auto] gap-1 items-center"
                >
                  <Input
                    placeholder="Label"
                    value={charge.label}
                    onChange={(e) =>
                      updateExtraCharge(charge.id, "label", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                  <Select
                    value={charge.effect}
                    onValueChange={(val) =>
                      updateExtraCharge(charge.id, "effect", val as any)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add (+)</SelectItem>
                      <SelectItem value="less">Less (-)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={charge.value}
                    onChange={(e) =>
                      updateExtraCharge(charge.id, "value", e.target.value)
                    }
                    className="h-8 text-right text-xs"
                  />
                  <Select
                    value={charge.type}
                    onValueChange={(val) =>
                      updateExtraCharge(charge.id, "type", val as any)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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

            {/* Calculations Breakdowns and Grand Total */}
            <div className="pt-2 border-t border-border/40 space-y-1 text-right font-mono text-[11px] text-muted-foreground">
              <div>Subtotal: ₹{grandTotals.netAmount.toFixed(2)}</div>
              {extraCharges
                .filter((c) => c.value)
                .map((c) => {
                  const val = c.type === "percentage" ? (rawTotal * Number(c.value)) / 100 : Number(c.value);
                  return (
                    <div key={c.id}>
                      {c.label || "Charge"}: {c.effect === "less" ? "-" : "+"}₹{val.toFixed(2)}
                    </div>
                  );
                })}
              <div>Taxable Value: ₹{grandTotals.taxableAmount.toFixed(2)}</div>
              {isInterstate ? (
                <div>IGST: ₹{grandTotals.igst.toFixed(2)}</div>
              ) : (
                <>
                  <div>CGST: ₹{grandTotals.cgst.toFixed(2)}</div>
                  <div>SGST: ₹{grandTotals.sgst.toFixed(2)}</div>
                </>
              )}
              {discount1Amt > 0 && <div>Discount 1: -₹{discount1Amt.toFixed(2)}</div>}
              {discount2Amt > 0 && <div>Discount 2: -₹{discount2Amt.toFixed(2)}</div>}
              <div className="text-sm font-bold text-foreground pt-1 border-t border-border/55 mt-1 font-sans">
                Grand Total: ₹{finalGrandTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message and Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold text-destructive uppercase">
          {message}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="h-10 text-xs font-bold uppercase tracking-wider px-8 ml-auto"
        >
          {saving ? (
            <>
              <Spinner className="mr-2" />
              Saving challan
            </>
          ) : (
            "Save Mill Outward"
          )}
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
