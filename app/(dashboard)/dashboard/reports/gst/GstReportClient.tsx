"use client";

import React, { useState, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, AlertTriangle, CheckCircle, Ban, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  state?: string | null;
}

interface TaxRate {
  taxRateId: number;
  taxName: string;
  taxPercent: number;
}

interface VoucherItem {
  itemId: number;
  hsnCode?: string | null;
  quantity: number;
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  netAmount: number;
  taxPercent: number;
  itemName?: string | null;
}

interface Voucher {
  voucherId: number;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  partyName?: string | null;
  partyGstNo?: string | null;
  items: VoucherItem[];
}

interface GstReportClientProps {
  company: Company;
  taxRates: TaxRate[];
  vouchers: Voucher[];
  canExport: boolean;
}

function GstReportContent({
  company,
  taxRates,
  vouchers,
  canExport,
}: GstReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Period defaults
  const fyStartYear = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return m >= 3 ? y : y - 1;
  })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [activeTab, setActiveTab] = useState<"gstr1" | "gstr3b" | "summary">("gstr1");
  const [isDetailed, setIsDetailed] = useState(true);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);

  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  // Helper: Format to Indian Currency
  const formatAmount = (val: number) => {
    const abs = Math.abs(val);
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);

    if (val < 0) {
      return `(-) ${formatted}`;
    }
    return formatted;
  };

  // -------------------------------------------------------------
  // LIVE EXCEPTION/UNCERTAIN TRANSACTIONS VALIDATOR
  // -------------------------------------------------------------
  const getVoucherErrors = (v: Voucher) => {
    const errors: string[] = [];
    const isGstVoucher = ["sale", "purchase", "credit_note", "debit_note"].includes(v.voucherType);
    if (!isGstVoucher) return errors;

    if (v.items.length === 0) {
      errors.push("No tax item entries found in voucher");
      return errors;
    }

    if (v.partyGstNo && v.partyGstNo.trim().length !== 15) {
      errors.push("Invalid Party GSTIN (must be 15 characters)");
    }

    v.items.forEach((item) => {
      if (!item.hsnCode || item.hsnCode.trim() === "") {
        errors.push(`Missing HSN/SAC code on line: ${item.itemName || "Unknown Item"}`);
      }

      const expectedTax = (item.taxableAmount * item.taxPercent) / 100;
      const actualTax = item.cgst + item.sgst + item.igst;
      if (Math.abs(expectedTax - actualTax) > 0.15) {
        errors.push(
          `Tax calculation mismatch: Expected ₹${expectedTax.toFixed(2)} (${item.taxPercent}%), got ₹${actualTax.toFixed(2)}`
        );
      }
    });

    return errors;
  };

  // Triangulation Categorization
  const uncertainVouchers = vouchers.filter((v) => getVoucherErrors(v).length > 0);
  const includedVouchers = vouchers.filter(
    (v) => ["sale", "purchase", "credit_note", "debit_note"].includes(v.voucherType) && getVoucherErrors(v).length === 0
  );
  const notRelevantVouchers = vouchers.filter((v) => !["sale", "purchase", "credit_note", "debit_note"].includes(v.voucherType));

  // -------------------------------------------------------------
  // GSTR-1 DATASHEET ROLLUPS
  // -------------------------------------------------------------
  const sales = includedVouchers.filter((v) => v.voucherType === "sale");
  const notes = includedVouchers.filter((v) => ["credit_note", "debit_note"].includes(v.voucherType));

  // 1. B2B Invoices (Registered Customer)
  const gstr1B2B = sales.filter((v) => v.partyGstNo && v.partyGstNo.trim().length === 15);

  // 2. B2C Large (Unregistered, Interstate, Invoice Value > 2.5 Lakhs)
  const gstr1B2CLarge = sales.filter((v) => {
    const hasGst = v.partyGstNo && v.partyGstNo.trim().length === 15;
    if (hasGst) return false;
    const isInterstate = v.items.some((item) => item.igst > 0);
    return isInterstate && v.totalAmount > 250000;
  });

  // 3. B2C Small (Unregistered, Intrastate OR Interstate Invoice Value <= 2.5 Lakhs)
  const gstr1B2CSmall = sales.filter((v) => {
    const hasGst = v.partyGstNo && v.partyGstNo.trim().length === 15;
    if (hasGst) return false;
    const isInterstate = v.items.some((item) => item.igst > 0);
    const isLarge = isInterstate && v.totalAmount > 250000;
    return !isLarge;
  });

  // 4. Credit/Debit Notes Registered
  const gstr1CDNReg = notes.filter((v) => v.partyGstNo && v.partyGstNo.trim().length === 15);

  // 5. Credit/Debit Notes Unregistered
  const gstr1CDNUnreg = notes.filter((v) => !v.partyGstNo || v.partyGstNo.trim().length !== 15);

  // 6. Exports
  const gstr1Exports = sales.filter((v) => {
    const nameLower = (v.partyName || "").toLowerCase();
    return nameLower.includes("export") || nameLower.includes("sez") || nameLower.includes("overseas");
  });

  // 7. Exempt/Nil-Rated/Non-GST
  const gstr1Exempt = sales.filter((v) => {
    const isExp = gstr1Exports.includes(v);
    if (isExp) return false;
    return v.items.length > 0 && v.items.every((item) => item.taxPercent === 0);
  });

  // Helper to rollup amounts for a group
  const rollup = (list: Voucher[]) => {
    let invoiceValue = 0;
    let taxableValue = 0;
    let igst = 0;
    let cgst = 0;
    let sgst = 0;

    list.forEach((v) => {
      // Credit note values are subtracted to reflect return adjustments
      const sign = v.voucherType === "credit_note" ? -1 : 1;
      invoiceValue += v.netAmount * sign;
      v.items.forEach((item) => {
        taxableValue += item.taxableAmount * sign;
        igst += item.igst * sign;
        cgst += item.cgst * sign;
        sgst += item.sgst * sign;
      });
    });

    return {
      count: list.length,
      invoiceValue,
      taxableValue,
      igst,
      cgst,
      sgst,
      totalTax: igst + cgst + sgst,
    };
  };

  // -------------------------------------------------------------
  // GSTR-3B DATASHEET ROLLUPS
  // -------------------------------------------------------------
  const purchases = includedVouchers.filter((v) => v.voucherType === "purchase");

  // Table 3.1 (a) Outward Taxable Supplies (excluding zero-rated, nil-rated, exempted)
  const gstr3bOutwardTaxable = sales.filter((v) => v.items.some((i) => i.taxPercent > 0));

  // Table 3.1 (b) Outward Taxable Supplies (zero-rated)
  const gstr3bOutwardZero = sales.filter((v) => {
    const isExport = (v.partyName || "").toLowerCase().match(/(export|sez|overseas)/);
    return isExport && v.items.every((i) => i.taxPercent === 0);
  });

  // Table 3.1 (c) Other Outward Supplies (nil-rated, exempted)
  const gstr3bOutwardExempt = sales.filter((v) => {
    const isExport = (v.partyName || "").toLowerCase().match(/(export|sez|overseas)/);
    return !isExport && v.items.length > 0 && v.items.every((i) => i.taxPercent === 0);
  });

  // Table 3.1 (d) Inward supplies liable to reverse charge
  const gstr3bInwardRcm = purchases.filter((v) => {
    const nameLower = (v.partyName || "").toLowerCase();
    return nameLower.includes("rcm") || nameLower.includes("gta") || nameLower.includes("transport") || nameLower.includes("reverse charge");
  });

  // Table 3.1 (e) Non-GST Outward Supplies
  const gstr3bNonGstOutward = sales.filter((v) => {
    const isExempt = gstr1Exempt.includes(v);
    const isExport = gstr1Exports.includes(v);
    if (isExempt || isExport) return false;
    return v.items.length > 0 && v.items.every((item) => item.taxPercent === 0);
  });

  // Table 4 (A) (1) Import of Goods
  const gstr3bImportGoods = purchases.filter((v) => {
    const nameLower = (v.partyName || "").toLowerCase();
    const isImport = nameLower.includes("import") || nameLower.includes("overseas") || nameLower.includes("foreign");
    const hasInventory = v.items.some((item) => item.itemName !== null);
    return isImport && hasInventory;
  });

  // Table 4 (A) (2) Import of Services
  const gstr3bImportServices = purchases.filter((v) => {
    const nameLower = (v.partyName || "").toLowerCase();
    const isImport = nameLower.includes("import") || nameLower.includes("overseas") || nameLower.includes("foreign");
    const hasInventory = v.items.some((item) => item.itemName !== null);
    return isImport && !hasInventory;
  });

  // Table 4 (A) (3) Inward supplies liable to reverse charge (other than 1 & 2)
  const gstr3bEligibleRcm = gstr3bInwardRcm;

  // Table 4 (A) (4) Inward Supplies from ISD
  const gstr3bISD = purchases.filter((v) => {
    const nameLower = (v.partyName || "").toLowerCase();
    return nameLower.includes("isd") || nameLower.includes("distributor");
  });

  // Table 4 (A) (5) All Other ITC
  const gstr3bOtherITC = purchases.filter(
    (v) =>
      !gstr3bImportGoods.includes(v) &&
      !gstr3bImportServices.includes(v) &&
      !gstr3bEligibleRcm.includes(v) &&
      !gstr3bISD.includes(v)
  );

  // -------------------------------------------------------------
  // RATE-WISE SUMMARY DATASHEET
  // -------------------------------------------------------------
  const getRateWiseSummary = () => {
    const map = new Map<
      number,
      {
        rate: number;
        salesTaxable: number;
        salesCgst: number;
        salesSgst: number;
        salesIgst: number;
        purchaseTaxable: number;
        purchaseCgst: number;
        purchaseSgst: number;
        purchaseIgst: number;
      }
    >();

    // Seed default rates
    taxRates.forEach((r) => {
      map.set(r.taxPercent, {
        rate: r.taxPercent,
        salesTaxable: 0,
        salesCgst: 0,
        salesSgst: 0,
        salesIgst: 0,
        purchaseTaxable: 0,
        purchaseCgst: 0,
        purchaseSgst: 0,
        purchaseIgst: 0,
      });
    });

    includedVouchers.forEach((v) => {
      const isSale = ["sale", "credit_note", "debit_note"].includes(v.voucherType);
      const sign = v.voucherType === "credit_note" ? -1 : 1;

      v.items.forEach((item) => {
        const rate = item.taxPercent;
        if (!map.has(rate)) {
          map.set(rate, {
            rate,
            salesTaxable: 0,
            salesCgst: 0,
            salesSgst: 0,
            salesIgst: 0,
            purchaseTaxable: 0,
            purchaseCgst: 0,
            purchaseSgst: 0,
            purchaseIgst: 0,
          });
        }
        const data = map.get(rate)!;
        if (isSale) {
          data.salesTaxable += item.taxableAmount * sign;
          data.salesCgst += item.cgst * sign;
          data.salesSgst += item.sgst * sign;
          data.salesIgst += item.igst * sign;
        } else {
          data.purchaseTaxable += item.taxableAmount * sign;
          data.purchaseCgst += item.cgst * sign;
          data.purchaseSgst += item.sgst * sign;
          data.purchaseIgst += item.igst * sign;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  };

  const rateSummaries = getRateWiseSummary();

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Suppress Margin Print Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            margin: 0mm;
          }
          body {
            margin: 0mm !important;
          }
          .print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            padding: 1.5rem !important;
            box-sizing: border-box !important;
            background-color: white !important;
          }
        }
      `,
        }}
      />

      {/* Screen Title & Period Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-foreground">GST Triangulation Reports</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Detailed/Condensed View Toggle */}
          <Button variant="outline" onClick={() => setIsDetailed(!isDetailed)} className="flex items-center gap-2">
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed" : "Detailed"}
          </Button>

          {/* Period Button */}
          <Button variant="outline" onClick={() => setShowPeriodModal(true)} className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          {/* Export PDF Button */}
          <Button onClick={triggerPrint} className="flex items-center gap-2 bg-primary text-primary-foreground">
            <Download className="h-4 w-4" />
            Save PDF
          </Button>
        </div>
      </div>

      {/* Tally-style Triangulation / Voucher Count Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card text-sm no-print">
        <div className="border-b border-border bg-muted/40 p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Voucher Statistics (Triangulation Summary)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4">
          <div className="p-4 border-r border-b md:border-b-0 border-border bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Vouchers</p>
            <p className="text-2xl font-bold mt-2 text-foreground font-mono">{vouchers.length}</p>
          </div>
          <div className="p-4 border-r border-b md:border-b-0 border-border bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Included in Returns</p>
            <p className="text-2xl font-bold mt-2 text-success font-mono flex items-center gap-1.5">
              <CheckCircle className="h-5 w-5" />
              {includedVouchers.length}
            </p>
          </div>
          <div className="p-4 border-r border-b md:border-b-0 border-border bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Not Relevant / Excluded</p>
            <p className="text-2xl font-bold mt-2 text-muted-foreground font-mono flex items-center gap-1.5">
              <Ban className="h-5 w-5" />
              {notRelevantVouchers.length}
            </p>
          </div>
          <div
            className={`p-4 cursor-pointer transition ${
              uncertainVouchers.length > 0
                ? "bg-danger/5 hover:bg-danger/10 border-danger/25"
                : "bg-muted/10 hover:bg-muted/20"
            }`}
            onClick={() => uncertainVouchers.length > 0 && setShowExceptionModal(true)}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase">Uncertain (Corrections Needed)</p>
            <div className="flex items-center justify-between mt-2">
              <p
                className={`text-2xl font-bold font-mono flex items-center gap-1.5 ${
                  uncertainVouchers.length > 0 ? "text-danger" : "text-muted-foreground"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
                {uncertainVouchers.length}
              </p>
              {uncertainVouchers.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/20 flex items-center gap-1">
                  Resolve <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tab Row */}
      <div className="flex border-b border-border no-print gap-1">
        <button
          onClick={() => setActiveTab("gstr1")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            activeTab === "gstr1" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          GSTR-1 (Outward Returns)
        </button>
        <button
          onClick={() => setActiveTab("gstr3b")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            activeTab === "gstr3b" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          GSTR-3B (Summary Return)
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            activeTab === "summary" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          GST Rate-wise Ledger Summary
        </button>
      </div>

      {/* Main Report Table Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area">
        {/* Printable-only Header */}
        <div className="hidden print:block text-center py-6 border-b border-border bg-card mb-4">
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">{company.companyName}</h1>
          {company.gstNo && <p className="text-xs text-muted-foreground mt-1">GSTIN: {company.gstNo}</p>}
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mt-2">
            {activeTab === "gstr1" ? "GSTR-1 Outward Supplies Statement" : activeTab === "gstr3b" ? "GSTR-3B Return Statement" : "GST Rate Summary"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Period: {new Date(fromParam).toLocaleDateString("en-IN")} to {new Date(toParam).toLocaleDateString("en-IN")}
          </p>
        </div>

        {/* -------------------------------------------------------------
            TAB 1: GSTR-1 LAYOUT
           ------------------------------------------------------------- */}
        {activeTab === "gstr1" && (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 text-left">Returns Category & Table details</th>
                <th className="p-3 text-right">Count</th>
                <th className="p-3 text-right">Invoice Value</th>
                <th className="p-3 text-right">Taxable Value</th>
                <th className="p-3 text-right">IGST</th>
                <th className="p-3 text-right">CGST</th>
                <th className="p-3 text-right">SGST</th>
                <th className="p-3 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "1. B2B Invoices (4A, 4B, 4C, 6B, 6C)", list: gstr1B2B },
                { name: "2. B2C Large Invoices (5A, 5B)", list: gstr1B2CLarge },
                { name: "3. B2C Small Invoices (7)", list: gstr1B2CSmall },
                { name: "4. Credit/Debit Notes Registered (9B)", list: gstr1CDNReg },
                { name: "5. Credit/Debit Notes Unregistered (9B)", list: gstr1CDNUnreg },
                { name: "6. Exports (6A)", list: gstr1Exports },
                { name: "7. Nil Rated / Exempted Supplies (8)", list: gstr1Exempt },
              ].map((row) => {
                const vals = rollup(row.list);
                return (
                  <React.Fragment key={row.name}>
                    <tr className="border-b border-border hover:bg-muted/10 font-semibold text-foreground">
                      <td className="p-3 text-left">{row.name}</td>
                      <td className="p-3 text-right font-mono">{vals.count}</td>
                      <td className="p-3 text-right font-mono">{formatAmount(vals.invoiceValue)}</td>
                      <td className="p-3 text-right font-mono">{formatAmount(vals.taxableValue)}</td>
                      <td className="p-3 text-right font-mono">{vals.igst !== 0 ? formatAmount(vals.igst) : "—"}</td>
                      <td className="p-3 text-right font-mono">{vals.cgst !== 0 ? formatAmount(vals.cgst) : "—"}</td>
                      <td className="p-3 text-right font-mono">{vals.sgst !== 0 ? formatAmount(vals.sgst) : "—"}</td>
                      <td className="p-3 text-right font-mono font-bold">{vals.totalTax !== 0 ? formatAmount(vals.totalTax) : "—"}</td>
                    </tr>
                    {/* Detailed Invoice Rows under each category */}
                    {isDetailed && row.list.length > 0 && (
                      <tr className="bg-muted/10">
                        <td colSpan={8} className="p-0 border-b border-border">
                          <table className="w-full text-xs font-mono">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border/50 uppercase">
                                <th className="p-2 text-left pl-6">Inv No / Date</th>
                                <th className="p-2 text-left">Party Name & GSTIN</th>
                                <th className="p-2 text-right">Value</th>
                                <th className="p-2 text-right">Taxable</th>
                                <th className="p-2 text-right">IGST</th>
                                <th className="p-2 text-right">CGST</th>
                                <th className="p-2 text-right">SGST</th>
                                <th className="p-2 text-right pr-6">Total Tax</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.list.map((v) => {
                                const details = rollup([v]);
                                return (
                                  <tr key={v.voucherId} className="border-b border-border/20 hover:bg-muted/30">
                                    <td className="p-2 pl-6 text-left">
                                      {v.voucherNo} <span className="text-[10px] text-muted-foreground">({v.voucherDate})</span>
                                    </td>
                                    <td className="p-2 text-left">
                                      <div className="font-semibold text-foreground">{v.partyName || "Walk-in Customer"}</div>
                                      {v.partyGstNo && <div className="text-[10px] text-muted-foreground">GST: {v.partyGstNo}</div>}
                                    </td>
                                    <td className="p-2 text-right">{formatAmount(details.invoiceValue)}</td>
                                    <td className="p-2 text-right">{formatAmount(details.taxableValue)}</td>
                                    <td className="p-2 text-right">{details.igst !== 0 ? formatAmount(details.igst) : "—"}</td>
                                    <td className="p-2 text-right">{details.cgst !== 0 ? formatAmount(details.cgst) : "—"}</td>
                                    <td className="p-2 text-right">{details.sgst !== 0 ? formatAmount(details.sgst) : "—"}</td>
                                    <td className="p-2 text-right pr-6 font-bold">{formatAmount(details.totalTax)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Grand Total */}
              <tr className="border-t-2 border-border bg-muted/20 font-bold text-foreground">
                <td className="p-3 text-left">Grand Outward Total</td>
                <td className="p-3 text-right font-mono">
                  {rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).count}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).invoiceValue)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).taxableValue)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).igst)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).cgst)}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).sgst)}
                </td>
                <td className="p-3 text-right font-mono text-base">
                  {formatAmount(rollup(includedVouchers.filter((v) => ["sale", "credit_note", "debit_note"].includes(v.voucherType))).totalTax)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* -------------------------------------------------------------
            TAB 2: GSTR-3B LAYOUT
           ------------------------------------------------------------- */}
        {activeTab === "gstr3b" && (
          <div className="divide-y divide-border">
            {/* Table 3.1 */}
            <div>
              <div className="bg-muted/40 p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                Table 3.1: Outward Supplies & Inward Supplies liable to Reverse Charge
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-xs font-bold text-muted-foreground uppercase border-b border-border font-mono">
                  <tr>
                    <th className="p-3 text-left">Supplies Type</th>
                    <th className="p-3 text-right">Total Taxable Value</th>
                    <th className="p-3 text-right">Integrated Tax</th>
                    <th className="p-3 text-right">Central Tax</th>
                    <th className="p-3 text-right">State/UT Tax</th>
                    <th className="p-3 text-right">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "(a) Outward Taxable Supplies (other than zero-rated, nil-rated, exempted)", list: gstr3bOutwardTaxable },
                    { name: "(b) Outward Taxable Supplies (zero-rated)", list: gstr3bOutwardZero },
                    { name: "(c) Other Outward Supplies (nil-rated, exempted)", list: gstr3bOutwardExempt },
                    { name: "(d) Inward Supplies (liable to reverse charge)", list: gstr3bInwardRcm },
                    { name: "(e) Non-GST Outward Supplies", list: gstr3bNonGstOutward },
                  ].map((row) => {
                    const vals = rollup(row.list);
                    return (
                      <tr key={row.name} className="border-b border-border hover:bg-muted/10 text-foreground">
                        <td className="p-3 text-left font-medium">{row.name}</td>
                        <td className="p-3 text-right font-mono">{formatAmount(vals.taxableValue)}</td>
                        <td className="p-3 text-right font-mono">{vals.igst !== 0 ? formatAmount(vals.igst) : "—"}</td>
                        <td className="p-3 text-right font-mono">{vals.cgst !== 0 ? formatAmount(vals.cgst) : "—"}</td>
                        <td className="p-3 text-right font-mono">{vals.sgst !== 0 ? formatAmount(vals.sgst) : "—"}</td>
                        <td className="p-3 text-right font-mono font-bold">{vals.totalTax !== 0 ? formatAmount(vals.totalTax) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table 4: Eligible ITC */}
            <div>
              <div className="bg-muted/40 p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                Table 4: Eligible Input Tax Credit (ITC)
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/20 text-xs font-bold text-muted-foreground uppercase border-b border-border font-mono">
                  <tr>
                    <th className="p-3 text-left">ITC Details</th>
                    <th className="p-3 text-right">Total Taxable Purchase</th>
                    <th className="p-3 text-right">Integrated Tax</th>
                    <th className="p-3 text-right">Central Tax</th>
                    <th className="p-3 text-right">State/UT Tax</th>
                    <th className="p-3 text-right">Total ITC Available</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "(A)(1) Import of Goods", list: gstr3bImportGoods },
                    { name: "(A)(2) Import of Services", list: gstr3bImportServices },
                    { name: "(A)(3) Inward supplies liable to reverse charge (other than 1 & 2)", list: gstr3bEligibleRcm },
                    { name: "(A)(4) Inward supplies from ISD", list: gstr3bISD },
                    { name: "(A)(5) All other ITC (Eligible local purchases)", list: gstr3bOtherITC },
                  ].map((row) => {
                    const vals = rollup(row.list);
                    return (
                      <tr key={row.name} className="border-b border-border hover:bg-muted/10 text-foreground">
                        <td className="p-3 text-left font-medium">{row.name}</td>
                        <td className="p-3 text-right font-mono">{formatAmount(vals.taxableValue)}</td>
                        <td className="p-3 text-right font-mono">{vals.igst !== 0 ? formatAmount(vals.igst) : "—"}</td>
                        <td className="p-3 text-right font-mono">{vals.cgst !== 0 ? formatAmount(vals.cgst) : "—"}</td>
                        <td className="p-3 text-right font-mono">{vals.sgst !== 0 ? formatAmount(vals.sgst) : "—"}</td>
                        <td className="p-3 text-right font-mono font-bold">{vals.totalTax !== 0 ? formatAmount(vals.totalTax) : "—"}</td>
                      </tr>
                    );
                  })}
                  {/* Totals */}
                  <tr className="bg-muted/20 font-bold border-b border-border text-foreground">
                    <td className="p-3 text-left">(C) Net ITC Available (A - B)</td>
                    <td className="p-3 text-right font-mono">{formatAmount(rollup(purchases).taxableValue)}</td>
                    <td className="p-3 text-right font-mono">{formatAmount(rollup(purchases).igst)}</td>
                    <td className="p-3 text-right font-mono">{formatAmount(rollup(purchases).cgst)}</td>
                    <td className="p-3 text-right font-mono">{formatAmount(rollup(purchases).sgst)}</td>
                    <td className="p-3 text-right font-mono text-base">{formatAmount(rollup(purchases).totalTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 3: RATE-WISE GST SUMMARY
           ------------------------------------------------------------- */}
        {activeTab === "summary" && (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 text-left">GST Rate Percent</th>
                <th className="p-3 text-right">Sales Taxable Value</th>
                <th className="p-3 text-right">Sales IGST</th>
                <th className="p-3 text-right">Sales CGST</th>
                <th className="p-3 text-right">Sales SGST</th>
                <th className="p-3 text-right">Purchase Taxable Value</th>
                <th className="p-3 text-right">Purchase IGST</th>
                <th className="p-3 text-right">Purchase CGST</th>
                <th className="p-3 text-right">Purchase SGST</th>
              </tr>
            </thead>
            <tbody>
              {rateSummaries.map((summary) => (
                <tr key={summary.rate} className="border-b border-border hover:bg-muted/10 text-foreground font-mono">
                  <td className="p-3 text-left font-bold font-sans text-sm">{summary.rate.toFixed(2)}%</td>
                  <td className="p-3 text-right">{formatAmount(summary.salesTaxable)}</td>
                  <td className="p-3 text-right">{summary.salesIgst !== 0 ? formatAmount(summary.salesIgst) : "—"}</td>
                  <td className="p-3 text-right">{summary.salesCgst !== 0 ? formatAmount(summary.salesCgst) : "—"}</td>
                  <td className="p-3 text-right">{summary.salesSgst !== 0 ? formatAmount(summary.salesSgst) : "—"}</td>
                  <td className="p-3 text-right">{formatAmount(summary.purchaseTaxable)}</td>
                  <td className="p-3 text-right">{summary.purchaseIgst !== 0 ? formatAmount(summary.purchaseIgst) : "—"}</td>
                  <td className="p-3 text-right">{summary.purchaseCgst !== 0 ? formatAmount(summary.purchaseCgst) : "—"}</td>
                  <td className="p-3 text-right">{summary.purchaseSgst !== 0 ? formatAmount(summary.purchaseSgst) : "—"}</td>
                </tr>
              ))}
              {rateSummaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No active GST rates summary found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Date Period selector dialog */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">
                From Date
              </Label>
              <Input
                id="from"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To Date
              </Label>
              <Input
                id="to"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApplyPeriod} className="bg-primary text-primary-foreground">
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive exceptions dialog for Uncertain Transactions */}
      <Dialog open={showExceptionModal} onOpenChange={setShowExceptionModal}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-danger flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Uncertain Transactions (Corrections Needed)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Tally-style Triangulation: Resolve the following structural validation errors to include these vouchers in GSTR returns.
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Voucher Details</th>
                    <th className="p-3 text-left">Party Name</th>
                    <th className="p-3 text-left text-danger">Errors Detected (Uncertainty reason)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {uncertainVouchers.map((v) => (
                    <tr key={v.voucherId} className="hover:bg-muted/5 font-mono text-xs">
                      <td className="p-3 text-left font-semibold">
                        <div className="text-foreground text-sm font-sans">{v.voucherNo}</div>
                        <div className="text-muted-foreground font-mono mt-0.5">{v.voucherDate} ({v.voucherType})</div>
                      </td>
                      <td className="p-3 text-left font-sans font-medium text-foreground">
                        {v.partyName || "Walk-in Party"}
                        {v.partyGstNo && <div className="text-xs text-muted-foreground font-mono mt-0.5">GST: {v.partyGstNo}</div>}
                      </td>
                      <td className="p-3 text-left text-danger font-sans">
                        <ul className="list-disc pl-4 space-y-1">
                          {getVoucherErrors(v).map((err, idx) => (
                            <li key={idx} className="text-xs">{err}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowExceptionModal(false)} variant="outline">
              Close Exception Viewer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GstReportClient(props: GstReportClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading GST Reports</span></div>}>
      <GstReportContent {...props} />
    </Suspense>
  );
}
