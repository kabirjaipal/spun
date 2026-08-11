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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, FileText, Eye } from "lucide-react";
import PrintInvoiceModal from "@/components/PrintInvoiceModal";
import BrokerHasteDialog from "@/components/BrokerHasteDialog";
import JobFormDrawer from "@/components/JobFormDrawer";
import PieceMetersDialog from "@/components/PieceMetersDialog";
import useRouter from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";

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
  pcs: string; // finish pcs (blank initially in process house mode)
  quantity: string; // finish quantity (blank initially in process house mode)
  greyPcs: string; // grey pcs
  greyQuantity: string; // grey quantity
  tp: string; // transit pass
  fold: string; // fold percentage (default 100)
  rate: string; // job rate (blank initially in process house mode)
  jobType: string; // e.g. dyeing, printing, etc.
  jobRateType: "pcs" | "mtr";
  gstRateId: string;
  pieceMeters?: string[];
}

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  inventoryId: "",
  hsnCode: "",
  pcs: "",
  quantity: "",
  greyPcs: "0",
  greyQuantity: "0.0000",
  tp: "",
  fold: "100",
  rate: "",
  jobType: "dyeing",
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

export default function JobOutwardClient({
  company,
  jobs,
  inventory,
  taxRates,
  brokersHaste,
  inwardVouchers,
  inwardItems,
  canCreate,
  initialPastVouchers = [],
  editVoucher,
  editVoucherItems,
}: {
  company: {
    companyName: string;
    gstNo?: string | null;
    address?: string | null;
    state?: string | null;
    jobPartyType?: string | null;
  };
  jobs: JobOption[];
  inventory: InventoryOption[];
  taxRates: TaxRateOption[];
  brokersHaste: BrokerHasteOption[];
  inwardVouchers: InwardVoucher[];
  inwardItems: InwardItem[];
  canCreate: boolean;
  initialPastVouchers?: any[];
  editVoucher?: any;
  editVoucherItems?: any[];
}) {
  const router = useRouter.useRouter();
  const [isCreating, setIsCreating] = useState(!!editVoucher);
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
  const [jobStatus, setJobStatus] = useState<"finished" | "refinished">(
    "finished",
  );
  const [vehicleNo, setVehicleNo] = useState("");
  const [personName, setPersonName] = useState("");
  const [lotNo, setLotNo] = useState("");

  const [printRate, setPrintRate] = useState(true);
  const [printAmount, setPrintAmount] = useState(true);

  const [lineItems, setLineItems] = useState<LineItem[]>([EMPTY_LINE()]);
  const [pastVouchers, setPastVouchers] = useState<any[]>(initialPastVouchers);
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
      const res = await fetch("/api/vouchers/next-number?type=job_outward");
      if (res.ok) {
        const data = await res.json();
        if (data.nextVoucherNo) setVoucherNo(data.nextVoucherNo);
      }
    } catch (err) {
      console.error("Error fetching next job outward voucher number:", err);
    }
  };

  useEffect(() => {
    fetchNextVoucherNo();
  }, []);

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

  const selectedJobDetails = useMemo(() => {
    return localJobs.find((j) => String(j.jobId) === selectedJob) || null;
  }, [selectedJob, localJobs]);

  const partyInwardVouchers = useMemo(() => {
    if (!selectedJob) return [];
    return inwardVouchers.filter((v) => String(v.partyId) === selectedJob);
  }, [selectedJob, inwardVouchers]);

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
        pcs: "", // finish recieved pcs blank
        quantity: "", // finish recieved mtr blank
        greyPcs: String(item.pcs), // grey pcs auto
        greyQuantity: String(item.quantity), // grey mtr auto
        tp: "", // TP blank
        fold: String(item.fold || 100),
        rate: "", // rate blank
        jobType: item.jobType || "dyeing",
        jobRateType: (item.jobRateType as any) || "mtr",
        gstRateId: item.gstRateId ? String(item.gstRateId) : "",
      })),
    );
    if (parentVoucher) {
      setRemarks(`Outward against JI Lot: ${parentVoucher.lotNo || ""}`);
      setLotNo(parentVoucher.lotNo || "");
    }
  }, [selectedInwardVoucherId, inwardItems, inwardVouchers, company.jobPartyType]);

  const isInterstate = useMemo(() => {
    const jobWorker = localJobs.find((c) => String(c.jobId) === selectedJob);
    if (!jobWorker) return false;
    const companyGst = company?.gstNo || "";
    const workerGst = jobWorker?.gstNo || "";
    if (companyGst && workerGst) {
      return companyGst.trim().slice(0, 2) !== workerGst.trim().slice(0, 2);
    }
    return false;
  }, [company, selectedJob, localJobs]);

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

      // Shortage calculation (greyQuantity - quantity) / greyQuantity * 100
      const greyMtr = Number(line.greyQuantity) || 0;
      const finishMtr = Number(line.quantity) || 0;
      const shortageQty = Math.max(0, greyMtr - finishMtr);
      const shortagePercent =
        greyMtr > 0
          ? Math.round((shortageQty / greyMtr) * 100 * 100) / 100
          : 0;

      return {
        amount,
        netAmount,
        taxableAmount,
        totalTax,
        cgst,
        sgst,
        igst,
        shortagePercent,
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
          // Fetch the last dated rate from DB
          fetch(`/api/inventory/last-rate?inventoryId=${value}`)
            .then((res) => res.json())
            .then((data) => {
              if (data && data.rate !== undefined) {
                updateLine(id, "rate", String(data.rate));
              }
            })
            .catch((err) => console.error("Error fetching last rate", err));

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

  function removeLine(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((items) => items.filter((item) => item.id !== id));
  }

  async function handleSubmit() {
    if (!canCreate) return;
    if (company.jobPartyType === "process_house") {
      if (!selectedJob || !voucherNo || !selectedInwardVoucherId) {
        setMessage("Select Job Party, Inward Voucher and enter voucher number.");
        return;
      }
    } else {
      if (!selectedJob || !voucherNo) {
        setMessage("Select Job Party and enter voucher number.");
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
        voucherType: "job_outward",
        voucherNo,
        voucherDate,
        partyId: Number(selectedJob),
        remarks: remarks || "Job Outward Challan",
        jobStatus,
        broker,
        haste,
        lrNo,
        lrDate: lrDate || null,
        transport,
        vehicleNo,
        personName,
        lotNo: lotNo || null,
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
            greyPcs: Number(line.greyPcs || 0),
            greyQuantity: Number(line.greyQuantity || 0),
            finishPcs: Number(line.pcs || 0),
            finishQuantity: Number(line.quantity || 0),
            tp: line.tp || "",
            shortagePercent: totals.shortagePercent,
          };
        }),
        ...(editVoucher ? { voucherId: editVoucher.voucherId } : {}),
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

      const savedData = await response.json();
      const savedVoucher = Array.isArray(savedData) ? savedData[0] : savedData;

      setMessage("Job Outward Challan created successfully.");

      const newPastVoucher = {
        voucherId: savedVoucher?.voucherId || Date.now(),
        voucherNo: body.voucherNo,
        voucherDate: body.voucherDate,
        status: "posted",
        totalAmount: grandTotals.amount,
        taxAmount: grandTotals.tax,
        netAmount: finalGrandTotal,
        remarks: body.remarks,
        lotNo: body.lotNo,
        party: selectedJobDetails ? {
          name: selectedJobDetails.jobName,
          gstNo: selectedJobDetails.gstNo,
          address: selectedJobDetails.address,
        } : null,
      };
      setPastVouchers((prev) => [newPastVoucher, ...prev].slice(0, 50));

      setIsCreating(false);
      if (editVoucher) {
        router.push("/dashboard/job-outward");
      }
      fetchNextVoucherNo();
      setRemarks("");
      setJobStatus("finished");
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
          voucherType: "job_outward",
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
          name: selectedJobDetails?.jobName || "Job Party",
          gstNo: selectedJobDetails?.gstNo,
          address: selectedJobDetails?.address,
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

  if (!isCreating) {
    return (
      <div className="space-y-6 p-2">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
              Job Outward History
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage and view your job outward history
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button
                onClick={() => {
                  router.push("/dashboard/job-outward");
                  setIsCreating(true);
                }}
                className="flex items-center gap-2 h-10"
              >
                <Plus className="h-4 w-4" /> Record Job Outward
              </Button>
            )}
          </div>
        </div>

        {/* Past Vouchers List */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          {pastVouchers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No job outward vouchers yet. Click 'Record Job Outward' above to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Voucher No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Job Party</th>
                    <th className="px-4 py-3">Lot No</th>
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.voucherDate}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {v.party?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {v.lotNo || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground italic text-xs max-w-[160px] truncate">
                        {v.remarks || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-foreground whitespace-nowrap">
                        {v.totalPcs > 0 ? `${v.totalPcs} pcs / ` : ""}{Number(v.totalQuantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground font-medium text-xs">
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
                          variant={
                            v.status === "posted" ? "secondary" : "outline"
                          }
                          className="text-xs uppercase font-semibold"
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Job Outward"
                              onClick={() => {
                                router.push(`/dashboard/job-outward?editId=${v.voucherId}`);
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
                            title="Preview Outward"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/vouchers?type=job_outward&partyId=${v.partyId}&includeItems=true`);
                                if (res.ok) {
                                  const items = await res.json();
                                  const matchedVoucher = items.find((x: any) => x.voucherId === v.voucherId);
                                  if (matchedVoucher) {
                                    setPrintVoucher({
                                      voucher: {
                                        voucherNo: matchedVoucher.voucherNo,
                                        voucherDate: matchedVoucher.voucherDate,
                                        voucherType: "job_outward",
                                        remarks: matchedVoucher.remarks,
                                        totalAmount: Number(matchedVoucher.totalAmount),
                                        taxAmount: Number(matchedVoucher.taxAmount),
                                        netAmount: Number(matchedVoucher.netAmount),
                                      },
                                      party: matchedVoucher.partyName ? {
                                        name: matchedVoucher.partyName,
                                        gstNo: matchedVoucher.partyGst,
                                        address: matchedVoucher.partyAddress,
                                      } : (v.party ?? {
                                        name: "Job Party",
                                        gstNo: null,
                                        address: null,
                                      }),
                                      lines: matchedVoucher.lineItems.map((line: any) => ({
                                        inventoryCode: line.inventoryCode || "PROD",
                                        inventoryName: line.inventoryName || "Item",
                                        quantity: Number(line.quantity),
                                        unit: line.unit || "MTR",
                                        rate: Number(line.rate),
                                        fold: Number(line.fold || 100),
                                        amount: Number(line.taxableAmount),
                                        gstPercent: 0,
                                      })),
                                    });
                                  }
                                }
                              } catch (err) {
                                console.error("Error loading voucher preview", err);
                              }
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
            lines={printVoucher.lines}
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
            {editVoucher ? "Edit Job Outward" : "Record Job Outward"}
          </h1>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setIsCreating(false);
            if (editVoucher) {
              router.push("/dashboard/job-outward");
            }
          }}
        >
          Cancel / View History
        </Button>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Party & Document Details */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
            Party & Document Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Party */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label >
                  Job Party
                </Label>
                {canCreate && (
                  <Button
                    type="button"
                    onClick={() => setShowJobModal(true)}
                    variant="link" size="sm" className="p-0 h-auto"
                  >
                    + New Job Party
                  </Button>
                )}
              </div>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
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

            {/* Haste */}
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

            {/* Voucher No. */}
            <div className="space-y-1.5">
              <Label >
                Voucher No.
              </Label>
              <Input value={voucherNo} readOnly disabled placeholder="Fetching..." className="h-10" />
            </div>

            {/* Inward Voucher Linking */}
            {company.jobPartyType === "process_house" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>
                  Against Inward Voucher No *
                </Label>
                <Select
                  value={selectedInwardVoucherId}
                  onValueChange={setSelectedInwardVoucherId}
                  disabled={!selectedJob}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        selectedJob
                          ? "Select Inward Voucher"
                          : "Select Job Party first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {partyInwardVouchers.map((v) => (
                      <SelectItem key={v.voucherId} value={String(v.voucherId)}>
                        JI: {v.voucherNo} {v.lotNo ? `(Lot No: ${v.lotNo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lot No. Input */}
            <div className="space-y-1.5 md:col-span-2">
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

            {/* Challan Date */}
            <div className="space-y-1.5">
              <Label >
                Challan Date
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => handleVoucherDateChange(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label >
                JOB CONDITION
              </Label>
              <RadioGroup
                value={jobStatus}
                onValueChange={(value) =>
                  setJobStatus(value as "finished" | "refinished")
                }
                className="flex flex-wrap gap-4"
              >
                {(["finished", "refinished"] as const).map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={`job-outward-${value}`} />
                    <Label htmlFor={`job-outward-${value}`} >
                      {value}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
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
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label >
                Driver Name
              </Label>
              <Input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Driver Name"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label >
                LR No.
              </Label>
              <Input
                value={lrNo}
                onChange={(e) => setLrNo(e.target.value)}
                placeholder="LR Number"
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
                onChange={(e) => handleLrDateChange(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Container */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
              Job Outward Items & Specifications
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Input inventory, PCS, meters (Qty), fold, job types, and rate
              types.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={addLine}
            className="h-10 text-xs font-semibold uppercase"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Item
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

                {company.jobPartyType === "process_house" ? (
                  /* Process House Mode: Inline Inward Link Fields */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Select Item */}
                    <div className="md:col-span-4 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Select Item
                      </Label>
                      <Select
                        value={line.inventoryId}
                        onValueChange={(v) =>
                          updateLine(line.id, "inventoryId", v)
                        }
                      >
                        <SelectTrigger className="w-full h-10">
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
                    </div>

                    {/* HSN Code */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
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

                    {/* Fold */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Fold %
                      </Label>
                      <Input
                        type="number"
                        value={line.fold || ""}
                        onChange={(e) =>
                          updateLine(line.id, "fold", e.target.value)
                        }
                        className="h-10 text-right bg-background"
                      />
                    </div>

                    {/* GST Rate */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        GST Rate
                      </Label>
                      <Select
                        value={line.gstRateId}
                        onValueChange={(v) => updateLine(line.id, "gstRateId", v)}
                      >
                        <SelectTrigger className="w-full h-10">
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

                    {/* TP */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        TP (Transit Pass)
                      </Label>
                      <Input
                        type="text"
                        placeholder="TP Number"
                        value={line.tp || ""}
                        onChange={(e) => updateLine(line.id, "tp", e.target.value)}
                        className="h-10 bg-background"
                      />
                    </div>

                    {/* Grey PCS */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Grey PCS
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={line.greyPcs || ""}
                        onChange={(e) =>
                          updateLine(line.id, "greyPcs", e.target.value)
                        }
                        className="h-10 text-right bg-background"
                      />
                    </div>

                    {/* Grey MTR */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Grey MTR
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={line.greyQuantity || ""}
                        onChange={(e) =>
                          updateLine(line.id, "greyQuantity", e.target.value)
                        }
                        className="h-10 text-right bg-background"
                      />
                    </div>

                    {/* Finish PCS */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Finish PCS
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.pcs || ""}
                          onChange={(e) =>
                            updateLine(line.id, "pcs", e.target.value)
                          }
                          className="h-10 text-right w-full bg-background"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 px-3 shrink-0 bg-secondary text-secondary-foreground"
                          onClick={() => setActivePieceLineId(line.id)}
                          title="Enter Piece Meters"
                        >
                          ⚙️
                        </Button>
                      </div>
                    </div>

                    {/* Finish MTR */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Finish MTR
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={line.quantity || ""}
                        onChange={(e) =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        className="h-10 text-right bg-background"
                      />
                    </div>

                    {/* Shortage % */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Shortage %
                      </Label>
                      <div className="h-10 flex items-center justify-end bg-muted/40 px-3 rounded-lg border border-border/50 text-xs font-bold text-danger">
                        {totals.shortagePercent > 0 ? (
                          <span>{totals.shortagePercent.toFixed(2)}%</span>
                        ) : (
                          <span className="text-success">No Shortage</span>
                        )}
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label className="text-xs font-semibold uppercase text-foreground">
                        Rate (₹)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={line.rate || ""}
                        onChange={(e) =>
                          updateLine(line.id, "rate", e.target.value)
                        }
                        className="h-10 text-right bg-background"
                      />
                    </div>
                  </div>
                ) : (
                  /* Trader Mode: Standard Layout */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Select Item */}
                    <div className="md:col-span-4 space-y-1.5">
                      <Label>Select Item</Label>
                      <Select
                        value={line.inventoryId}
                        onValueChange={(v) =>
                          updateLine(line.id, "inventoryId", v)
                        }
                      >
                        <SelectTrigger className="w-full">
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
                    </div>

                    {/* HSN Code */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>HSN Code</Label>
                      <Input
                        value={line.hsnCode}
                        onChange={(e) =>
                          updateLine(line.id, "hsnCode", e.target.value)
                        }
                        placeholder="HSN Code"
                        className="h-10"
                      />
                    </div>

                    {/* Fold */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Fold %</Label>
                      <Input
                        type="number"
                        value={line.fold}
                        onChange={(e) =>
                          updateLine(line.id, "fold", e.target.value)
                        }
                        className="h-10 text-right"
                      />
                    </div>

                    {/* PCS */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>PCS</Label>
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

                    {/* Quantity (Meters) */}
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Quantity (Mtrs)</Label>
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, "quantity", e.target.value)
                        }
                        readOnly={
                          !!(line.pieceMeters && line.pieceMeters.length > 0)
                        }
                        className={`h-10 text-right ${line.pieceMeters && line.pieceMeters.length > 0 ? "bg-muted cursor-not-allowed" : ""}`}
                      />
                    </div>

                    {/* Job Type */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label>Job Type</Label>
                      <Input
                        value={line.jobType}
                        onChange={(e) => updateLine(line.id, "jobType", e.target.value)}
                        placeholder="e.g. dyeing"
                        list={`job-types-${line.id}`}
                        className="h-10"
                      />
                      <datalist id={`job-types-${line.id}`}>
                        {uniqueJobTypes.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>

                    {/* Unit */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label>Unit</Label>
                      <Select
                        value={line.jobRateType}
                        onValueChange={(v) =>
                          updateLine(line.id, "jobRateType", v as any)
                        }
                      >
                        <SelectTrigger className="w-full">
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
                      <Label>Rate (₹)</Label>
                      <Input
                        type="number"
                        value={line.rate}
                        onChange={(e) =>
                          updateLine(line.id, "rate", e.target.value)
                        }
                        className="h-10 text-right"
                      />
                    </div>

                    {/* GST Rate */}
                    <div className="md:col-span-3 space-y-1.5">
                      <Label>GST Rate</Label>
                      <Select
                        value={line.gstRateId}
                        onValueChange={(v) => updateLine(line.id, "gstRateId", v)}
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
                  </div>
                )}

                {/* Calculations Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 bg-muted/30 p-3 rounded-lg border border-border/50 text-xs mt-2">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase block text-[10px]">
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
                    <span className="text-muted-foreground font-medium uppercase block text-[10px]">
                      Taxable Amount
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹{" "}
                      {totals.taxableAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase block text-[10px]">
                      CGST
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹ {totals.cgst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase block text-[10px]">
                      SGST
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹ {totals.sgst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase block text-[10px]">
                      IGST
                    </span>
                    <span className="font-semibold text-foreground text-sm">
                      ₹ {totals.igst.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground font-medium uppercase block text-[10px] text-primary">
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
            "Save Job Outward"
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
      <JobFormDrawer
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        onCreated={handleJobCreated}
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
