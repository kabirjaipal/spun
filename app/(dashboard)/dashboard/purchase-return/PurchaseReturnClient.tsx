"use client";

import React, { useMemo, useState, useEffect } from "react";
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
import { Trash2, Loader2, Edit, FileText, Eye, Plus, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useRouter from "next/navigation";
import PieceMetersDialog from "@/components/PieceMetersDialog";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import { formatDate, getLocalTodayString } from "@/lib/utils";

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

interface PurchaseInvoice {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  netAmount: string;
  lineItems: Array<{
    voucherItemId: number;
    inventoryId: number;
    inventoryName: string;
    inventoryCode: string;
    unit: string;
    ledgerId: number;
    hsnCode: string | null;
    pcs: number;
    quantity: string;
    fold: string;
    rate: string;
    gstRateId: number | null;
    taxableAmount: string;
    cgst: string;
    sgst: string;
    igst: string;
    netAmount: string;
    pieceMeters?: string[] | null;
  }>;
}

interface ReturnLineItem {
  id: string;
  inventoryId: string;
  inventoryName: string;
  ledgerId: string;
  hsnCode: string;
  pcs: string;
  originalPcs: number;
  quantity: string; // meters / quantity
  originalQuantity: number;
  fold: string; // fold percentage
  rate: string;
  gstRateId: string;
  invoiceNo: string;
  cgst: string;
  sgst: string;
  igst: string;
  pieceMeters?: string[];
}

interface PastVoucher {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  status: string;
  totalAmount: string;
  taxAmount: string;
  netAmount: string;
  remarks: string | null;
  partyId: number | null;
  party: {
    name: string;
    gstNo: string | null;
    address: string | null;
  } | null;
  totalPcs: number;
  totalQuantity: string | number;
}

export default function PurchaseReturnClient({
  company,
  companies,
  inventory,
  ledgers,
  taxRates,
  canCreate,
  initialPastVouchers = [],
  editVoucher,
  editVoucherItems,
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
  ledgers: LedgerOption[];
  taxRates: TaxRateOption[];
  canCreate: boolean;
  initialPastVouchers?: PastVoucher[];
  editVoucher?: any;
  editVoucherItems?: any[];
}) {
  const router = useRouter.useRouter();
  const [isCreating, setIsCreating] = useState(!!editVoucher);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [voucherNo, setVoucherNo] = useState(""); // Purchase Return No
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

  const fetchNextVoucherNo = async () => {
    try {
      const res = await fetch("/api/vouchers/next-number?type=purchase_return");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) {
          setVoucherNo(data.nextVoucherNo);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(
          "Failed to fetch next voucher number:",
          res.status,
          errData,
        );
      }
    } catch (err) {
      console.error("Error fetching next voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

  // Logistics
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState(getLocalTodayString());
  const [transport, setTransport] = useState("");
  const [remarks, setRemarks] = useState("");

  // API State for Invoices
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  // Line items for return & editing state
  const [lineItems, setLineItems] = useState<ReturnLineItem[]>([]);
  const [pastVouchers, setPastVouchers] = useState<PastVoucher[]>(initialPastVouchers);
  const [printVoucher, setPrintVoucher] = useState<any>(null);
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

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

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

  // Fetch company invoices
  useEffect(() => {
    if (!selectedCompany) {
      setInvoices([]);
      setLineItems([]);
      setSelectedInvoiceIds([]);
      setEditingLineId(null);
      return;
    }

    async function fetchInvoices() {
      setLoadingInvoices(true);
      try {
        const res = await fetch(
          `/api/vouchers?type=purchase&partyId=${selectedCompany}&includeItems=true`,
        );
        if (res.ok) {
          const data = await res.json();
          setInvoices(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInvoices(false);
      }
    }
    fetchInvoices();
  }, [selectedCompany]);

  // Handle invoice dropdown/checkbox toggle
  function handleToggleInvoice(invoice: PurchaseInvoice) {
    const isSelected = selectedInvoiceIds.includes(invoice.voucherId);
    let newIds = [];
    if (isSelected) {
      newIds = selectedInvoiceIds.filter((id) => id !== invoice.voucherId);
      // Remove lines from this invoice
      setLineItems((items) =>
        items.filter((item) => item.invoiceNo !== invoice.voucherNo),
      );
      // Close editing panel if the item being edited was from this invoice
      setEditingLineId((currId) => {
        const item = lineItems.find((l) => l.id === currId);
        if (item && item.invoiceNo === invoice.voucherNo) {
          return null;
        }
        return currId;
      });
    } else {
      newIds = [...selectedInvoiceIds, invoice.voucherId];
      // Add lines from this invoice
      const newItems: ReturnLineItem[] = invoice.lineItems.map((line) => ({
        id: crypto.randomUUID(),
        inventoryId: String(line.inventoryId),
        inventoryName: line.inventoryName || "Item",
        ledgerId: String(line.ledgerId),
        hsnCode: line.hsnCode || "",
        pcs: "",
        originalPcs: line.pcs,
        quantity: "",
        originalQuantity: Number(line.quantity),
        fold: String(line.fold),
        rate: String(line.rate),
        gstRateId: String(line.gstRateId || ""),
        invoiceNo: invoice.voucherNo,
        cgst: "",
        sgst: "",
        igst: "",
        pieceMeters: line.pieceMeters || [],
      }));
      setLineItems((items) => [...items, ...newItems]);
    }
    setSelectedInvoiceIds(newIds);
  }

  // Check if Interstate or Intrastate GST
  const isInterstate = useMemo(() => {
    const subCompany = companies.find(
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
  }, [company, selectedCompany, companies]);

  const lineTotals = useMemo(() => {
    const linesRaw = lineItems.map((line) => {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const fold = Number(line.fold) || 100;
      const amount = Math.round(qty * rate * 100) / 100;
      const netAmount = Math.round(((qty * rate * fold) / 100) * 100) / 100;
      return { line, amount, netAmount };
    });

    const totalSubtotal = linesRaw.reduce((sum, item) => sum + item.netAmount, 0);

    const calculatedExtraCharges = extraCharges.reduce((sum, c) => {
      if (!c.value) return sum;
      const isLess = c.effect === "less";
      const amt = c.type === "percentage"
        ? (totalSubtotal * Number(c.value)) / 100
        : Number(c.value);
      return isLess ? sum - amt : sum + amt;
    }, 0);

    return linesRaw.map(({ line, amount, netAmount }) => {
      const gstRatePercent =
        Number(
          line.gstRateId
            ? taxRates.find((t) => String(t.taxRateId) === line.gstRateId)
                ?.taxPercent
            : 0,
        ) || 0;

      const allocatedExtraCharge = totalSubtotal > 0
        ? (netAmount / totalSubtotal) * calculatedExtraCharges
        : calculatedExtraCharges / linesRaw.length;

      const taxableAmount = netAmount + allocatedExtraCharge;

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

      const cgst = Math.round(((taxableAmount * cgstPercent) / 100) * 100) / 100;
      const sgst = Math.round(((taxableAmount * sgstPercent) / 100) * 100) / 100;
      const igst = Math.round(((taxableAmount * igstPercent) / 100) * 100) / 100;

      const totalTaxVal = cgst + sgst + igst;

      return {
        amount,
        netAmount,
        cgst,
        sgst,
        igst,
        cgstPercent,
        sgstPercent,
        igstPercent,
        totalTax: totalTaxVal,
        net: netAmount + totalTaxVal,
      };
    });
  }, [lineItems, taxRates, isInterstate, extraCharges]);

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
      { amount: 0, netAmount: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 },
    );
  }, [lineTotals]);

  const totalExtraCharges = useMemo(() => {
    return extraCharges.reduce((sum, c) => {
      if (!c.value) return sum;
      const isLess = c.effect === "less";
      const amt = c.type === "percentage"
        ? (grandTotals.netAmount * Number(c.value)) / 100
        : Number(c.value);
      return isLess ? sum - amt : sum + amt;
    }, 0);
  }, [extraCharges, grandTotals.netAmount]);

  const finalGrandTotal = useMemo(() => {
    return grandTotals.total + totalExtraCharges;
  }, [grandTotals.total, totalExtraCharges]);

  function updateLine(id: string, field: keyof ReturnLineItem, value: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      }),
    );
  }

  function removeLine(id: string) {
    if (editingLineId === id) setEditingLineId(null);
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
    if (!selectedCompany || !voucherNo) {
      setMessage("Select company and enter return number.");
      return;
    }

    const validLines = lineItems.filter(
      (line) =>
        line.inventoryId && Number(line.quantity) > 0 && Number(line.rate) >= 0,
    );
    if (validLines.length === 0) {
      setMessage("Add at least one line item with valid quantity and rate.");
      return;
    }

    // Validate quantities do not exceed original inward quantity
    for (const line of validLines) {
      if (Number(line.quantity) > line.originalQuantity) {
        setMessage(
          `Error: Quantity returned for item in invoice ${line.invoiceNo} exceeds original purchased quantity (${line.originalQuantity}).`,
        );
        return;
      }
      if (Number(line.pcs || 0) > line.originalPcs) {
        setMessage(
          `Error: PCS returned for item in invoice ${line.invoiceNo} exceeds original purchased PCS (${line.originalPcs}).`,
        );
        return;
      }
    }

    const totalSubtotal = validLines.reduce((sum, line) => {
      const index = lineItems.indexOf(line);
      const totals = lineTotals[index];
      return sum + (totals?.netAmount || 0);
    }, 0);

    const computedBillDetails = selectedInvoiceIds.map((invoiceId) => {
      const inv = invoices.find((i) => i.voucherId === invoiceId);
      if (!inv) return null;

      let invoiceLineTotal = 0;
      let invoiceSubtotal = 0;
      validLines.forEach((line) => {
        if (line.invoiceNo === inv.voucherNo) {
          const index = lineItems.indexOf(line);
          const totals = lineTotals[index];
          if (totals) {
            invoiceLineTotal += totals.net;
            invoiceSubtotal += totals.netAmount;
          }
        }
      });

      const extraChargesAllocated = totalSubtotal > 0
        ? (invoiceSubtotal / totalSubtotal) * totalExtraCharges
        : totalExtraCharges / selectedInvoiceIds.length;

      const totalForInvoice = invoiceLineTotal + extraChargesAllocated;

      return {
        voucherId: inv.voucherId,
        voucherNo: inv.voucherNo,
        amount: Math.round(totalForInvoice * 100) / 100,
      };
    }).filter((x): x is { voucherId: number; voucherNo: string; amount: number } => !!x);

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "purchase_return",
        voucherNo,
        voucherDate,
        partyId: Number(selectedCompany),
        remarks:
          remarks ||
          `Purchase Return - Against Invoices: ${selectedInvoiceIds.map((id) => invoices.find((inv) => inv.voucherId === id)?.voucherNo).join(", ")}`,
        lrNo,
        lrDate: lrDate || null,
        transport,
        parentVoucherId: selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : null,
        billDetails: computedBillDetails.length > 0 ? computedBillDetails : null,
        extraCharges: totalExtraCharges,
        extraChargesData: extraCharges
          .filter((c) => c.value)
          .map(({ id, ...rest }) => rest),
        lineItems: validLines.map((line) => {
          const totals = lineTotals[lineItems.indexOf(line)];
          return {
            inventoryId: Number(line.inventoryId),
            ledgerId: Number(line.ledgerId),
            hsnCode: line.hsnCode,
            pcs: Number(line.pcs || 0),
            quantity: Number(line.quantity),
            fold: Number(line.fold || 100),
            rate: Number(line.rate),
            gstRateId: line.gstRateId ? Number(line.gstRateId) : null,
            cgst: totals?.cgst || 0,
            sgst: totals?.sgst || 0,
            igst: totals?.igst || 0,
            pieceMeters: line.pieceMeters,
          };
        }),
        ...(editVoucher ? { voucherId: editVoucher.voucherId } : {}),
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "Failed to save purchase return.");
      }

      setMessage("Purchase Return created successfully.");
      const savedVoucher = json.voucher || json;
      setPastVouchers((prev) => [
        {
          voucherId: savedVoucher.voucherId,
          voucherNo: savedVoucher.voucherNo,
          voucherDate: savedVoucher.voucherDate,
          status: savedVoucher.status,
          totalAmount: savedVoucher.totalAmount,
          taxAmount: savedVoucher.taxAmount,
          netAmount: savedVoucher.netAmount,
          remarks: savedVoucher.remarks,
          partyId: savedVoucher.partyId,
          party: companies.find((c) => c.companyId === savedVoucher.partyId) ? {
            name: companies.find((c) => c.companyId === savedVoucher.partyId)!.companyName,
            gstNo: companies.find((c) => c.companyId === savedVoucher.partyId)!.gstNo,
            address: companies.find((c) => c.companyId === savedVoucher.partyId)!.address,
          } : null,
          totalQuantity: validLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
          totalPcs: validLines.reduce((sum, line) => sum + (Number(line.pcs) || 0), 0),
        },
        ...prev,
      ].slice(0, 50));
      setIsCreating(false);
      if (editVoucher) {
        router.push("/dashboard/purchase-return");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save voucher.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isCreating) {
    return (
      <div className="space-y-6 p-2">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
              Purchase Return History
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage and view your purchase return history
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button
                onClick={() => {
                  router.push("/dashboard/purchase-return");
                  setIsCreating(true);
                }}
                className="flex items-center gap-2 h-10"
              >
                <Plus className="h-4 w-4" /> Record Purchase Return
              </Button>
            )}
          </div>
        </div>

        {/* Past Vouchers List */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          {pastVouchers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No purchase return vouchers yet. Click 'Record Purchase Return' above to create one.
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
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-right">Taxable</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right">Net Total</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pastVouchers.map((v) => (
                    <tr
                      key={v.voucherId}
                      className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-foreground">
                        {v.voucherNo}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {v.voucherDate}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {v.party?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground italic text-xs max-w-[160px] truncate">
                        {v.remarks || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground whitespace-nowrap">
                        {v.totalPcs > 0 ? `${v.totalPcs} pcs / ` : ""}{Number(v.totalQuantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">
                        ₹{Number(v.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                        ₹{Number(v.taxAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground text-xs">
                        ₹{Number(v.netAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={v.status === "posted" ? "secondary" : "outline"}
                          className="text-[10px] uppercase font-semibold py-0.5 px-1.5"
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Purchase Return"
                              onClick={() => {
                                router.push(`/dashboard/purchase-return?editId=${v.voucherId}`);
                                setIsCreating(true);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Preview Invoice"
                            onClick={() => {
                              setPrintVoucher({
                                voucher: {
                                  voucherNo: v.voucherNo,
                                  voucherDate: v.voucherDate,
                                  voucherType: "purchase_return",
                                  remarks: v.remarks,
                                  totalAmount: Number(v.totalAmount),
                                  taxAmount: Number(v.taxAmount),
                                  netAmount: Number(v.netAmount),
                                },
                                party: v.party ?? {
                                  name: "Company",
                                  gstNo: null,
                                  address: null,
                                },
                              });
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {printVoucher && (
          <PrintInvoiceModal
            isOpen={!!printVoucher}
            onClose={() => setPrintVoucher(null)}
            company={company}
            party={printVoucher.party}
            voucher={printVoucher.voucher}
            lines={[]}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
            {editVoucher ? "Edit Purchase Return" : "Record Purchase Return"}
          </h1>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setIsCreating(false);
            if (editVoucher) {
              router.push("/dashboard/purchase-return");
            }
          }}
        >
          Cancel / View History
        </Button>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party, Invoices & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Party, Invoices & Document Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label >
                Company (Party)
              </Label>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
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

            <div className="space-y-1.5">
              <Label >
                Remarks
              </Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Return reasons"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label >
                Voucher No.
              </Label>
              <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label >
                Return Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => handleVoucherDateChange(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2 col-span-1 md:col-span-2">
              <Label className="text-xs font-semibold uppercase text-primary">
                Select Invoices to Return Items From (Optional)
              </Label>
              {loadingInvoices ? (
                <div className="flex items-center gap-2">
                  <Spinner className="text-muted-foreground" />
                  <span>Loading invoices</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const inv = invoices.find(
                        (i) => String(i.voucherId) === val,
                      );
                      if (inv) handleToggleInvoice(inv);
                    }}
                    disabled={!selectedCompany}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={!selectedCompany ? "Select a Party first" : "Click to select/toggle purchase invoices"} />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => {
                        const isSelected = selectedInvoiceIds.includes(
                          inv.voucherId,
                        );
                        return (
                          <SelectItem
                            key={inv.voucherId}
                            value={String(inv.voucherId)}
                          >
                            {isSelected ? "✓ " : ""}
                            {inv.voucherNo} ({formatDate(inv.voucherDate)}) -
                            ₹{Number(inv.netAmount).toFixed(2)}
                          </SelectItem>
                        );
                      })}
                      {selectedCompany && invoices.length === 0 && (
                        <SelectItem value="none" disabled>No purchase invoices found for this company</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedInvoiceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedInvoiceIds.map((id) => {
                        const inv = invoices.find((i) => i.voucherId === id);
                        if (!inv) return null;
                        return (
                          <span
                            key={id}
                            onClick={() => handleToggleInvoice(inv)}
                            className="inline-flex items-center gap-1 bg-primary/10 text-primary hover:bg-danger/10 hover:text-danger border border-primary/20 rounded px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors"
                          >
                            {inv.voucherNo} ✕
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
                onChange={(e) => handleLrDateChange(e.target.value)}
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
        </div>
      </div>

      {/* Return Items Container */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2">
          Items to Return
        </h2>

        <div className="space-y-4">
          {lineItems.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-xs uppercase font-medium">
              Select one or more purchase invoices to populate return items.
            </div>
          ) : (
            lineItems.map((line, index) => {
              const totals = lineTotals[index] || {
                amount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                cgstPercent: 0,
                sgstPercent: 0,
                igstPercent: 0,
                net: 0,
                netAmount: 0,
              };
              const unit =
                inventory.find(
                  (p) => String(p.inventoryId) === line.inventoryId,
                )?.unit || "PCS";
              return (
                <div
                  key={line.id}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 relative"
                >
                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between border-b border-border pb-2 gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Invoice:{" "}
                        <span className="text-foreground">
                          {line.invoiceNo}
                        </span>{" "}
                        | Item #{index + 1}:{" "}
                        <span className="text-foreground">
                          {line.inventoryName}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => removeLine(line.id)}
                        className="text-danger hover:bg-danger/10 hover:text-danger h-9 px-3 text-xs uppercase font-semibold flex items-center gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" /> Remove Row
                      </Button>
                    </div>
                  </div>



                  {/* Input Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* HSN Code */}
                    <div className="md:col-span-3 space-y-1.5">
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
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Fold %
                      </Label>
                      <Input
                        type="number"
                        value={line.fold || ""}
                        onChange={(e) =>
                          updateLine(line.id, "fold", e.target.value)
                        }
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Return PCS */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Return PCS
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={line.pcs || ""}
                          onChange={(e) =>
                            updateLine(line.id, "pcs", e.target.value)
                          }
                          className="h-10 text-right w-full"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-10 px-0 shrink-0"
                          onClick={() => setActivePieceLineId(line.id)}
                          title="Enter Piece Meters"
                        >
                          ⚙️
                        </Button>
                      </div>
                    </div>

                    {/* Return Qty */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Return Qty ({unit})
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.quantity || ""}
                        onChange={(e) =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Rate */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        Rate (₹)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.rate || ""}
                        onChange={(e) =>
                          updateLine(line.id, "rate", e.target.value)
                        }
                        className="h-10 text-right"
                      />
                    </div>

                    {/* CGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        CGST %
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={
                          isInterstate ? "0.00" : totals.cgstPercent.toFixed(2)
                        }
                        value={isInterstate ? "" : line.cgst || ""}
                        onChange={(e) =>
                          updateLine(line.id, "cgst", e.target.value)
                        }
                        disabled={isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* SGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        SGST %
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={
                          isInterstate ? "0.00" : totals.sgstPercent.toFixed(2)
                        }
                        value={isInterstate ? "" : line.sgst || ""}
                        onChange={(e) =>
                          updateLine(line.id, "sgst", e.target.value)
                        }
                        disabled={isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* IGST % */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label >
                        IGST %
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={
                          !isInterstate ? "0.00" : totals.igstPercent.toFixed(2)
                        }
                        value={!isInterstate ? "" : line.igst || ""}
                        onChange={(e) =>
                          updateLine(line.id, "igst", e.target.value)
                        }
                        disabled={!isInterstate}
                        className="h-10 text-right"
                      />
                    </div>

                    {/* Original Qty stats */}
                    <div className="md:col-span-12">
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Original Invoice Qty:{" "}
                        <span className="font-bold text-foreground">
                          {line.originalPcs} PCS / {line.originalQuantity}{" "}
                          {unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calculations Summary Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        Amount
                      </span>
                      <span className="font-semibold text-foreground text-xs">
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
                      <span className="font-semibold text-foreground text-xs">
                        ₹{" "}
                        {totals.netAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        CGST
                      </span>
                      <span className="font-semibold text-muted-foreground text-xs">
                        ₹{" "}
                        {totals.cgst.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        SGST
                      </span>
                      <span className="font-semibold text-muted-foreground text-xs">
                        ₹{" "}
                        {totals.sgst.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px]">
                        IGST
                      </span>
                      <span className="font-semibold text-muted-foreground text-xs">
                        ₹{" "}
                        {totals.igst.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-medium uppercase tracking-wider block text-[10px] text-primary">
                        Net Total
                      </span>
                      <span className="font-bold text-foreground text-xs">
                        ₹{" "}
                        {totals.net.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
                Extra Charges & Deductions
              </Label>
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
                  className="h-7 px-2 text-xs text-success hover:text-success"
                >
                  + Add Charge
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
                  className="h-7 px-2 text-xs text-danger hover:text-danger"
                >
                  - Less Charge
                </Button>
              </div>
            </div>
            {extraCharges.map((charge) => (
              <div
                key={charge.id}
                className="grid grid-cols-[1fr_90px_90px_90px_auto] gap-2 items-center"
              >
                <Input
                  placeholder="Label (e.g. Freight)"
                  value={charge.label}
                  onChange={(e) =>
                    updateExtraCharge(charge.id, "label", e.target.value)
                  }
                  className="h-9"
                />
                <Select
                  value={charge.effect}
                  onValueChange={(val) =>
                    updateExtraCharge(charge.id, "effect", val as any)
                  }
                >
                  <SelectTrigger className="h-9">
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
                  className="h-9 text-right font-medium"
                />
                <Select
                  value={charge.type}
                  onValueChange={(val) =>
                    updateExtraCharge(charge.id, "type", val as any)
                  }
                >
                  <SelectTrigger className="h-9">
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
              .map((c) => {
                const isLess = c.effect === "less";
                const amt = c.type === "percentage"
                  ? (grandTotals.netAmount * Number(c.value)) / 100
                  : Number(c.value);
                return (
                  <div key={c.id} className={`text-xs ${isLess ? "text-danger" : "text-success font-medium"}`}>
                    {c.label || (isLess ? "Deduction" : "Extra Charge")}: {isLess ? "-" : "+"}₹{amt.toFixed(2)}
                  </div>
                );
              })}
            <div className="text-muted-foreground font-semibold uppercase text-[10px] pt-1">
              Taxable Value: ₹{grandTotals.netAmount.toFixed(2)}
            </div>
            <div className="text-muted-foreground font-semibold uppercase text-[10px]">
              Total Taxable (with Charges): ₹{(grandTotals.netAmount + totalExtraCharges).toFixed(2)}
            </div>
            <div className="text-muted-foreground font-semibold uppercase text-[10px]">
              GST Tax Amount: ₹{grandTotals.tax.toFixed(2)}
            </div>
            <div className="text-muted-foreground font-semibold uppercase text-xs pt-1 border-t border-border/50">
              Total Return Amount:
            </div>
            <div className="text-lg font-black text-foreground">
              ₹{" "}
              {finalGrandTotal.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Save Return Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSubmit}
          disabled={saving || !canCreate}
          className="h-10 px-8 font-bold uppercase"
        >
          {saving ? (
            <>
              <Spinner className="mr-2" />
              Saving Return
            </>
          ) : (
            "Save Purchase Return"
          )}
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/65 p-4 text-sm text-center font-medium text-foreground">
          {message}
        </div>
      )}

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



      {printVoucher && (
        <PrintInvoiceModal
          isOpen={!!printVoucher}
          onClose={() => setPrintVoucher(null)}
          company={company}
          party={printVoucher.party}
          voucher={printVoucher.voucher}
          lines={[]}
        />
      )}
    </div>
  );
}
