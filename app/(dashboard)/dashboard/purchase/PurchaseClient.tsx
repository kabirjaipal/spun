"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Trash2 } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";
import PieceMetersDialog from "@/components/PieceMetersDialog";
import PartyFormDrawer from "@/components/PartyFormDrawer";
import { calculatePreTaxDiscount, getLocalTodayString } from "@/lib/utils";

interface CompanyOption {
  companyId: number;
  companyName: string;
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
  gstRateId: "",
  cgst: "",
  sgst: "",
  igst: "",
  unitType: "meter",
  pieceMeters: [],
});

export default function PurchaseClient({
  company,
  companies,
  inventory,
  taxRates,
  brokersHaste,
  canCreate,
}: {
  company: {
    companyName: string;
    gstNo?: string | null;
    address?: string | null;
    companyType?: string;
    state?: string | null;
  };
  companies: CompanyOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  canCreate: boolean;
}) {
  const router = useRouter();

  const [localCompanies, setLocalCompanies] =
    useState<CompanyOption[]>(companies);

  // Dialog States for inline creation
  const [showPartyModal, setShowPartyModal] = useState(false);

  const [brokersHasteData, setBrokersHasteData] = useState(brokersHaste);

  const [showBrokerDialog, setShowBrokerDialog] = useState(false);
  const [showHasteDialog, setShowHasteDialog] = useState(false);

  const brokers = brokersHasteData.filter((r) => r.type === "broker");
  const hastes = brokersHasteData.filter((r) => r.type === "haste");

  function handlePartyCreated(newParty: any) {
    const newOption: CompanyOption = {
      companyId: newParty.companyId,
      companyName: newParty.companyName,
      gstNo: newParty.gstNo,
      address: newParty.address,
      state: newParty.state,
    };
    setLocalCompanies((prev) => [...prev, newOption]);
    setSelectedCompany(String(newParty.companyId));
  }

  const purchaseType = "purchase";
  const [selectedCompany, setSelectedCompany] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(
    getLocalTodayString(),
  );
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    getLocalTodayString(),
  );
  const [goodsName, setGoodsName] = useState("");

  // Textile-specific logistics fields
  const [broker, setBroker] = useState("");
  const [haste, setHaste] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState(getLocalTodayString());
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [personName, setPersonName] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [printVoucher, setPrintVoucher] = useState<any>(null);

  const [discountType, setDiscountType] = useState<"percentage" | "value">(
    "percentage",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [discountType2, setDiscountType2] = useState<"percentage" | "value">(
    "percentage",
  );
  const [discountValue2, setDiscountValue2] = useState("");

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

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=purchase");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next purchase voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  // Piece meters modal state
  const [activePieceLineId, setActivePieceLineId] = useState<string | null>(
    null,
  );

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
          quantity:
            totalQty > 0
              ? String(parseFloat(totalQty.toFixed(2)))
              : item.quantity,
          pieceMeters: meters,
        };
      }),
    );
    setActivePieceLineId(null);
  }

  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const subCompany = localCompanies.find(
      (s) => String(s.companyId) === selectedCompany,
    );
    if (company?.state && subCompany?.state) {
      return (
        company.state.trim().toLowerCase() !==
        subCompany.state.trim().toLowerCase()
      );
    }
    const companyGst = company?.gstNo || "";
    const subCompanyGst = subCompany?.gstNo || "";
    if (!companyGst || !subCompanyGst) return false;
    return companyGst.slice(0, 2) !== subCompanyGst.slice(0, 2);
  }, [company, selectedCompany, localCompanies]);

  const lineTotals = useMemo(() => {
    const linesRaw = lineItems.map((line) => {
      const pcs = Number(line.pcs) || 0;
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;

      const unit = line.unitType === "pcs" ? pcs : qty;
      const amount = Math.round(unit * rate * 100) / 100;
      const netAmount = Math.round(((unit * rate * fold) / 100) * 100) / 100;
      return { line, amount, netAmount };
    });

    const rawTotal = linesRaw.reduce((sum, item) => sum + item.netAmount, 0);
    const discountValNum = Number(discountValue) || 0;

    return linesRaw.map(({ line, amount, netAmount }) => {
      const gstRatePercent =
        Number(
          line.gstRateId
            ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)
              ?.taxPercent
            : 0,
        ) || 0;

      const lineDiscount1 = calculatePreTaxDiscount(
        netAmount,
        rawTotal,
        discountType,
        discountValue,
      );
      const lineDiscount2 = calculatePreTaxDiscount(
        netAmount,
        rawTotal,
        discountType2,
        discountValue2,
      );
      const lineDiscount = lineDiscount1 + lineDiscount2;
      const discountedNetAmount = Math.max(
        0,
        Math.round((netAmount - lineDiscount) * 100) / 100,
      );

      let defaultCgst = 0;
      let defaultSgst = 0;
      let defaultIgst = 0;

      if (isInterstate) {
        defaultIgst = gstRatePercent;
      } else {
        defaultCgst = gstRatePercent / 2;
        defaultSgst = gstRatePercent / 2;
      }

      const cgstPercent = isInterstate
        ? 0
        : line.cgst !== ""
          ? Number(line.cgst) || 0
          : defaultCgst;
      const sgstPercent = isInterstate
        ? 0
        : line.sgst !== ""
          ? Number(line.sgst) || 0
          : defaultSgst;
      const igstPercent = isInterstate
        ? line.igst !== ""
          ? Number(line.igst) || 0
          : defaultIgst
        : 0;

      const cgst =
        Math.round(((discountedNetAmount * cgstPercent) / 100) * 100) / 100;
      const sgst =
        Math.round(((discountedNetAmount * sgstPercent) / 100) * 100) / 100;
      const igst =
        Math.round(((discountedNetAmount * igstPercent) / 100) * 100) / 100;

      const totalTaxVal = cgst + sgst + igst;

      return {
        amount,
        rawNetAmount: netAmount,
        netAmount: discountedNetAmount,
        lineDiscount,
        cgst,
        sgst,
        igst,
        cgstPercent,
        sgstPercent,
        igstPercent,
        totalTax: totalTaxVal,
        net: discountedNetAmount + totalTaxVal,
      };
    });
  }, [
    lineItems,
    taxRates,
    isInterstate,
    discountType,
    discountValue,
    discountType2,
    discountValue2,
  ]);

  const grandTotals = useMemo(() => {
    return lineTotals.reduce(
      (acc, item) => ({
        amount: acc.amount + item.amount,
        rawNetAmount: acc.rawNetAmount + item.rawNetAmount,
        netAmount: acc.netAmount + item.netAmount,
        discount: acc.discount + item.lineDiscount,
        cgst: acc.cgst + item.cgst,
        sgst: acc.sgst + item.sgst,
        igst: acc.igst + item.igst,
        tax: acc.tax + item.totalTax,
        total: acc.total + item.net,
      }),
      {
        amount: 0,
        rawNetAmount: 0,
        netAmount: 0,
        discount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        tax: 0,
        total: 0,
      },
    );
  }, [lineTotals]);

  const discount1Amt = useMemo(() => {
    return lineTotals.reduce(
      (sum, item) =>
        sum +
        calculatePreTaxDiscount(
          item.rawNetAmount,
          grandTotals.rawNetAmount,
          discountType,
          discountValue,
        ),
      0,
    );
  }, [lineTotals, grandTotals.rawNetAmount, discountType, discountValue]);

  const discount2Amt = useMemo(() => {
    return lineTotals.reduce(
      (sum, item) =>
        sum +
        calculatePreTaxDiscount(
          item.rawNetAmount,
          grandTotals.rawNetAmount,
          discountType2,
          discountValue2,
        ),
      0,
    );
  }, [lineTotals, grandTotals.rawNetAmount, discountType2, discountValue2]);

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
      }),
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

    const validLines = lineItems.filter(
      (line) =>
        line.inventoryId &&
        Number(line.quantity) >= 0 &&
        Number(line.rate) >= 0,
    );
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
            quantity: Number(line.quantity),
            fold: Number(line.fold || 100),
            rate: Number(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals?.cgst || 0,
            sgst: totals?.sgst || 0,
            igst: totals?.igst || 0,
            jobRateType: line.unitType,
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
        throw new Error(json.error || "Failed to save purchase voucher.");
      }

      setMessage("Purchase voucher created successfully.");
      fetchNextVoucherNo();
      setInvoiceNo("");
      setGoodsName("");
      setRemarks("");
      setBroker("");
      setHaste("");
      setLrNo("");
      setLrDate("");
      setTransport("");
      setDiscountValue("");
      setDiscountValue2("");
      setExtraCharges([]);
      setLineItems([EMPTY_LINE()]);

      // Print preview setup
      const subCompany = localCompanies.find(
        (s) => String(s.companyId) === selectedCompany,
      );
      setPrintVoucher({
        voucher: {
          voucherNo: body.voucherNo,
          voucherDate: body.voucherDate,
          voucherType: "purchase",
          remarks: body.remarks,
          totalAmount: grandTotals.netAmount,
          taxAmount: grandTotals.tax,
          netAmount: finalGrandTotal,
          extraCharges: totalExtraCharges,
          extraChargesData: extraCharges
            .filter((c) => c.value)
            .map(({ id, ...rest }) => rest),
        },
        party: {
          name: subCompany?.companyName || "Name",
          gstNo: subCompany?.gstNo,
          address: subCompany?.address,
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
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryCode: prod?.inventoryCode || "PROD",
            inventoryName: prod?.inventoryName || "Item",
            quantity: qty,
            unit: prod?.unit || "MTR",
            rate: rt,
            fold: fd,
            amount: totals?.netAmount || 0,
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
            Purchase Invoice Entry
          </h1>
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
            {/* Party Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label >
                  Name
                </Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowPartyModal(true)}
                  className="p-0 h-auto"
                >
                  + New Party
                </Button>
              </div>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose name" />
                </SelectTrigger>
                <SelectContent>
                  {localCompanies.map((s) => (
                    <SelectItem key={s.companyId} value={String(s.companyId)}>
                      {s.companyName} {s.gstNo ? `(${s.gstNo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label >
                Remarks
              </Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Voucher descriptions"
                className="h-10"
              />
            </div>

            {/* Voucher No & Voucher Date */}
            <div className="space-y-1.5">
              <Label >
                Voucher No.
              </Label>
              <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label >
                Voucher Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Invoice Number & Invoice Date */}
            <div className="space-y-1.5">
              <Label >
                Invoice Number
              </Label>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2025"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label >
                Invoice Date
              </Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Name of Goods Purchased */}
            <div className="space-y-1.5 md:col-span-2">
              <Label >
                Name of Goods Purchased
              </Label>
              <Input
                value={goodsName}
                onChange={(e) => setGoodsName(e.target.value)}
                placeholder="e.g. Cotton fabric, Polyester yarn, Chemicals"
                className="h-10"
              />
            </div>

            {/* Broker & Haste */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label >
                  Broker
                </Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowBrokerDialog(true)}
                  className="p-0 h-auto"
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
                  variant="link"
                  size="sm"
                  onClick={() => setShowHasteDialog(true)}
                  className="p-0 h-auto"
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
        </div>

        {/* Logistics details */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Logistics & Shipping
          </h2>

          <div className="space-y-1.5">
            <Label >
              LR No.
            </Label>
            <Input
              value={lrNo}
              onChange={(e) => setLrNo(e.target.value)}
              placeholder="Lorry Receipt No."
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label >
                Transport
              </Label>
              <Input
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                placeholder="Transport Service"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label >
              Vehicle No.
            </Label>
            <Input
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              placeholder="e.g. GJ-05-XX-XXXX"
              className="h-10"
            />
          </div>
        </div>
      </div>

      {/* Line Items Container */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Purchase Items & Fabric details
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Input PCS count, main meters (Qty), and fold percentage.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={addLine}
            className="h-10 text-sm font-semibold uppercase"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Line Item
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
                  <div className="md:col-span-3 space-y-1.5">
                    <Label >
                      Select Item
                    </Label>
                    <Select
                      value={line.inventoryId}
                      onValueChange={(val) =>
                        updateLine(line.id, "inventoryId", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((p) => (
                          <SelectItem
                            key={p.inventoryId}
                            value={String(p.inventoryId)}
                          >
                            {p.inventoryCode} — {p.inventoryName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => router.push("/dashboard/inventory")}
                        className="p-0 h-auto"
                      >
                        + New Item
                      </Button>
                    </div>
                  </div>

                  {/* HSN Code */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      HSN Code
                    </Label>
                    <Input
                      value={line.hsnCode}
                      onChange={(e) =>
                        updateLine(line.id, "hsnCode", e.target.value)
                      }
                      className="h-10 w-full"
                      placeholder="HSN Code"
                    />
                  </div>

                  {/* Fold */}
                  <div className="md:col-span-1 space-y-1.5">
                    <Label >
                      Fold %
                    </Label>
                    <Input
                      type="number"
                      value={line.fold}
                      onChange={(e) =>
                        updateLine(line.id, "fold", e.target.value)
                      }
                      className="h-10 text-right"
                      placeholder="100"
                    />
                  </div>

                  {/* PCS */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      PCS
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        value={line.pcs}
                        onChange={(e) =>
                          updateLine(line.id, "pcs", e.target.value)
                        }
                        readOnly={
                          !!(line.pieceMeters && line.pieceMeters.length > 0)
                        }
                        className={`h-10 text-right w-full ${line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}`}
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

                  {/* Quantity */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      Quantity
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.id, "quantity", e.target.value)
                      }
                      readOnly={
                        !!(line.pieceMeters && line.pieceMeters.length > 0)
                      }
                      className={`h-10 text-right font-medium ${line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}`}
                    />
                  </div>

                  {/* Unit */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      Unit
                    </Label>
                    <Select
                      value={line.unitType}
                      onValueChange={(val) =>
                        updateLine(line.id, "unitType", val as any)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meter">Meter</SelectItem>
                        <SelectItem value="pcs">Pcs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Rate */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label >
                      Rate (₹)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.rate}
                      onChange={(e) =>
                        updateLine(line.id, "rate", e.target.value)
                      }
                      className="h-10 text-right font-semibold"
                    />
                  </div>

                  {/* GST Rate */}
                  <div className="md:col-span-3 space-y-1.5">
                    <Label >
                      GST Rate
                    </Label>
                    <Select
                      value={line.gstRateId}
                      onValueChange={(val) =>
                        updateLine(line.id, "gstRateId", val)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tax %" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxRates.map((t) => (
                          <SelectItem
                            key={t.taxRateId}
                            value={String(t.taxRateId)}
                          >
                            {t.taxName} ({t.taxPercent}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CGST */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      CGST %
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={
                        isInterstate ? "0.00" : totals?.cgstPercent.toFixed(2)
                      }
                      value={isInterstate ? "" : line.cgst || ""}
                      onChange={(e) =>
                        updateLine(line.id, "cgst", e.target.value)
                      }
                      disabled={isInterstate}
                      className="h-10 text-right font-medium"
                    />
                  </div>

                  {/* SGST */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      SGST %
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={
                        isInterstate ? "0.00" : totals?.sgstPercent.toFixed(2)
                      }
                      value={isInterstate ? "" : line.sgst || ""}
                      onChange={(e) =>
                        updateLine(line.id, "sgst", e.target.value)
                      }
                      disabled={isInterstate}
                      className="h-10 text-right font-medium"
                    />
                  </div>

                  {/* IGST */}
                  <div className="md:col-span-2 space-y-1.5">
                    <Label >
                      IGST %
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={
                        !isInterstate ? "0.00" : totals?.igstPercent.toFixed(2)
                      }
                      value={!isInterstate ? "" : line.igst || ""}
                      onChange={(e) =>
                        updateLine(line.id, "igst", e.target.value)
                      }
                      disabled={!isInterstate}
                      className="h-10 text-right font-medium"
                    />
                  </div>
                </div>

                {/* Calculations Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                      Amount
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹{totals?.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                      Net Amount
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹{totals?.netAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                      CGST
                    </span>
                    <span className="font-medium text-muted-foreground text-sm">
                      ₹{totals?.cgst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                      SGST
                    </span>
                    <span className="font-medium text-muted-foreground text-sm">
                      ₹{totals?.sgst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                      IGST
                    </span>
                    <span className="font-medium text-muted-foreground text-sm">
                      ₹{totals?.igst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px] text-primary">
                      Net Total
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      ₹{totals?.net.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary and Save Section */}
      <div className="grid gap-6 md:grid-cols-3 pt-4">
        {/* Discount Section */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Apply Discounts
          </h2>

          {/* Discount 1 */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border/40">
            <div className="space-y-1.5">
              <Label >
                Discount 1 Value
              </Label>
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
              <Label >
                Type
              </Label>
              <Select
                value={discountType}
                onValueChange={(val) => setDiscountType(val as any)}
              >
                <SelectTrigger className="w-full">
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
              <Label >
                Discount 2 Value
              </Label>
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
              <Label >
                Type
              </Label>
              <Select
                value={discountType2}
                onValueChange={(val) => setDiscountType2(val as any)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="value">Flat Value (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Extra Charges */}
          <div className="pt-3 border-t border-border/40 space-y-3">
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
        </div>

        {/* Empty Column */}
        <div className="hidden md:block"></div>

        {/* Totals Breakdown */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-sm text-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Summary
          </h2>

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Subtotal (Before Discount):
            </span>
            <span className="font-semibold text-foreground">
              ₹{grandTotals.rawNetAmount.toFixed(2)}
            </span>
          </div>

          {discount1Amt > 0 && (
            <div className="flex justify-between text-danger">
              <span>
                Discount 1 (
                {discountType === "percentage"
                  ? `${Number(discountValue)}%`
                  : "Flat"}
                ):
              </span>
              <span>-₹{discount1Amt.toFixed(2)}</span>
            </div>
          )}

          {discount2Amt > 0 && (
            <div className="flex justify-between text-danger">
              <span>
                Discount 2 (
                {discountType2 === "percentage"
                  ? `${Number(discountValue2)}%`
                  : "Flat"}
                ):
              </span>
              <span>-₹{discount2Amt.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable Value:</span>
            <span className="font-semibold text-foreground">
              ₹{grandTotals.netAmount.toFixed(2)}
            </span>
          </div>

          {!isInterstate ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST:</span>
                <span>₹{grandTotals.cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST:</span>
                <span>₹{grandTotals.sgst.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>IGST:</span>
              <span>₹{grandTotals.igst.toFixed(2)}</span>
            </div>
          )}

          {extraCharges
            .filter((c) => c.value)
            .map((c) => (
              <div key={c.id} className="flex justify-between text-foreground">
                <span>
                  {c.label || "Extra Charges"} (
                  {c.type === "percentage" ? `${c.value}%` : "Flat"}):
                </span>
                <span className="font-semibold text-success">
                  +₹
                  {(c.type === "percentage"
                    ? (grandTotals.total * Number(c.value)) / 100
                    : Number(c.value)
                  ).toFixed(2)}
                </span>
              </div>
            ))}

          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Grand Total:</span>
            <span className="text-foreground">
              ₹{finalGrandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Save Invoice Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSubmit}
          disabled={saving || !canCreate}
          className="h-10 px-8 font-bold uppercase"
        >
          {saving ? "Saving Voucher..." : "Save Invoice"}
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">
          {message}
        </div>
      )}

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
      <PartyFormDrawer
        isOpen={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        onCreated={handlePartyCreated}
      />

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
