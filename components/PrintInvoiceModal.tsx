"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

interface InvoiceLine {
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  gstPercent: number;
}

interface PrintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: {
    companyName: string;
    gstNo?: string | null;
    address?: string | null;
  };
  party: {
    name: string;
    gstNo?: string | null;
    address?: string | null;
  };
  voucher: {
    voucherNo: string;
    voucherDate: string;
    voucherType: string;
    remarks?: string | null;
    totalAmount: number;
    taxAmount: number;
    netAmount: number;
  };
  lines: InvoiceLine[];
}

// Simple Indian currency word converter
function numberToWords(num: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const g = ["", "Thousand", "Lakh", "Crore"];

  function helper(n: number): string {
    if (n === 0) return "";
    else if (n < 20) return a[n];
    else if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10];
    else return a[Math.floor(n / 100)] + "Hundred " + helper(n % 100);
  }

  const cleanNum = Math.floor(num);
  if (cleanNum === 0) return "Zero Rupees Only";

  let word = "";
  const splits = [100, 1000, 100000, 10000000];
  let temp = cleanNum;

  // Crore
  const cr = Math.floor(temp / 10000000);
  temp %= 10000000;
  if (cr > 0) word += helper(cr) + "Crore ";

  // Lakh
  const l = Math.floor(temp / 100000);
  temp %= 100000;
  if (l > 0) word += helper(l) + "Lakh ";

  // Thousand
  const th = Math.floor(temp / 1000);
  temp %= 1000;
  if (th > 0) word += helper(th) + "Thousand ";

  // Hundreds, tens, units
  if (temp > 0) word += helper(temp);

  const paisa = Math.round((num - cleanNum) * 100);
  let paisaWord = "";
  if (paisa > 0) {
    paisaWord = " and " + helper(paisa) + "Paise";
  }

  return word.trim() + " Rupees" + paisaWord + " Only";
}

export default function PrintInvoiceModal({
  isOpen,
  onClose,
  company,
  party,
  voucher,
  lines,
}: PrintInvoiceModalProps) {
  const isSale = voucher.voucherType === "sale";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 print-container">
        {/* Buttons (Hidden when printing) */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border no-print">
          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Invoice Preview</span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => window.print()} className="flex items-center gap-1.5">
              <Printer className="h-4 w-4" />
              <span>Print Invoice</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice Page Layout */}
        <div className="p-8 bg-white text-black font-sans text-xs border border-gray-300 shadow-inner print-area">
          {/* Top Label */}
          <div className="text-center font-bold text-sm tracking-widest border-b border-black pb-2 uppercase">
            {isSale ? "Tax Invoice" : "Purchase Invoice"}
          </div>

          {/* Header Section */}
          <div className="grid grid-cols-2 border-b border-black py-4 gap-4">
            <div>
              <div className="text-sm font-extrabold uppercase">{company.companyName}</div>
              <div className="text-gray-600 mt-1 whitespace-pre-wrap">{company.address || "No Address Added"}</div>
              <div className="mt-2 font-bold font-mono">GSTIN: {company.gstNo || "N/A"}</div>
            </div>
            <div className="text-right flex flex-col justify-between">
              <div>
                <span className="text-gray-500 font-bold uppercase block text-xs">Invoice Number</span>
                <span className="text-sm font-extrabold font-mono mt-0.5 block">{voucher.voucherNo}</span>
              </div>
              <div className="mt-4">
                <span className="text-gray-500 font-bold uppercase block text-xs">Date</span>
                <span className="text-sm font-extrabold font-mono mt-0.5 block">{voucher.voucherDate}</span>
              </div>
            </div>
          </div>

          {/* Billing Info */}
          <div className="border-b border-black py-4">
            <span className="text-gray-500 font-bold uppercase text-xs block mb-1">
              {isSale ? "Bill To (Buyer)" : "Bill From (Seller)"}
            </span>
            <div className="text-sm font-bold uppercase">{party.name}</div>
            <div className="text-gray-600 mt-1 whitespace-pre-wrap">{party.address || "No Address Added"}</div>
            <div className="mt-2 font-bold font-mono">GSTIN: {party.gstNo || "N/A"}</div>
          </div>

          {/* Invoice Table */}
          <table className="w-full border-collapse mt-4 text-left">
            <thead>
              <tr className="border-b border-black text-xs font-bold uppercase tracking-wider text-gray-500">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Quantity</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">GST Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-3 pr-2">
                    <span className="font-semibold text-black block">{line.productName}</span>
                    <span className="font-mono text-xs text-gray-500 block mt-0.5">{line.productCode}</span>
                  </td>
                  <td className="py-3 text-right font-mono">{line.quantity.toFixed(2)} {line.unit}</td>
                  <td className="py-3 text-right font-mono">₹{line.rate.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono">{line.gstPercent}%</td>
                  <td className="py-3 text-right font-semibold font-mono">₹{line.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Breakdown */}
          <div className="mt-6 grid grid-cols-2 gap-8 items-start">
            <div>
              <span className="text-gray-500 font-bold uppercase text-xs block">Amount in Words</span>
              <div className="mt-1 font-bold text-gray-800 leading-snug">{numberToWords(voucher.netAmount)}</div>

              {voucher.remarks && (
                <div className="mt-4">
                  <span className="text-gray-500 font-bold uppercase text-xs block">Remarks</span>
                  <div className="mt-1 font-medium text-gray-700 italic">{voucher.remarks}</div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="font-bold text-gray-500 uppercase text-xs">Taxable Subtotal</span>
                <span className="font-bold font-mono">₹{voucher.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="font-bold text-gray-500 uppercase text-xs">GST Tax ({isSale ? "Collected" : "Paid"})</span>
                <span className="font-bold font-mono">₹{voucher.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-extrabold">
                <span className="uppercase text-gray-800">Grand Total (Net)</span>
                <span className="font-mono">₹{voucher.netAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signature and T&C */}
          <div className="mt-12 pt-8 border-t border-gray-300 grid grid-cols-2 gap-4">
            <div>
              <div className="font-bold uppercase text-xs text-gray-500 mb-1">Terms & Conditions</div>
              <div className="text-xs text-gray-600 leading-snug">
                1. Goods once sold will not be returned or exchanged.<br />
                2. Subject to Surat jurisdiction only.
              </div>
            </div>
            <div className="text-right flex flex-col justify-between items-end min-h-[80px]">
              <div className="font-bold uppercase text-xs text-gray-500">For {company.companyName}</div>
              <div className="border-t border-black w-48 pt-1 text-center font-bold text-xs uppercase tracking-wider text-gray-500 mt-8">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
