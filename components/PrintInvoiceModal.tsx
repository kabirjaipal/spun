"use client";

import { useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Printer, Download, X } from "lucide-react";

interface InvoiceLine {
  inventoryCode: string;
  inventoryName: string;
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
    extraCharges?: number | string | null;
    extraChargesData?: Array<{ label?: string; value: string; type: "percentage" | "value"; effect?: "add" | "less" }> | null;
  };
  lines: InvoiceLine[];
}

function numberToWords(num: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function helper(n: number): string {
    if (n === 0) return "";
    if (n < 20) return a[n] + " ";
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "") + " ";
    return a[Math.floor(n / 100)] + " Hundred " + helper(n % 100);
  }

  const clean = Math.floor(num);
  if (clean === 0) return "Zero Rupees Only";

  let w = "";
  const cr = Math.floor(clean / 10000000);
  const l = Math.floor((clean % 10000000) / 100000);
  const th = Math.floor((clean % 100000) / 1000);
  const rest = clean % 1000;

  if (cr) w += helper(cr) + "Crore ";
  if (l) w += helper(l) + "Lakh ";
  if (th) w += helper(th) + "Thousand ";
  if (rest) w += helper(rest);

  const paisa = Math.round((num - clean) * 100);
  return w.trim() + " Rupees" + (paisa ? " and " + helper(paisa).trim() + " Paise" : "") + " Only";
}

const fmt = (n: number) => `₹${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export default function PrintInvoiceModal({ isOpen, onClose, company, party, voucher, lines }: PrintInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const isSale = voucher.voucherType === "sale";

  const triggerPrint = () => {
    const el = printRef.current;
    if (!el) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${voucher.voucherNo}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;background:#fff;padding:24px}
      .inv{max-width:760px;margin:0 auto;border:1px solid #ddd;padding:32px}
      .title{text-align:center;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding-bottom:12px;border-bottom:2px solid #111;margin-bottom:20px}
      .header{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:16px;border-bottom:1px solid #ddd;margin-bottom:16px}
      .co-name{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
      .co-addr{color:#555;font-size:11px;margin-top:4px;white-space:pre-wrap}
      .co-gst{font-family:monospace;font-weight:700;font-size:11px;margin-top:6px}
      .inv-meta{text-align:right}
      .meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
      .meta-value{font-size:13px;font-weight:800;font-family:monospace;margin-top:2px}
      .bill-section{padding-bottom:16px;border-bottom:1px solid #ddd;margin-bottom:16px}
      .section-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
      .party-name{font-size:13px;font-weight:800;text-transform:uppercase}
      .party-addr{color:#555;font-size:11px;margin-top:3px;white-space:pre-wrap}
      .party-gst{font-family:monospace;font-weight:700;font-size:11px;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;padding:8px 6px;border-bottom:2px solid #111;white-space:nowrap}
      td{padding:10px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
      .inventory-name{font-weight:700;color:#111}
      .inventory-code{font-family:monospace;font-size:10px;color:#888;margin-top:2px}
      .text-right{text-align:right}
      .mono{font-family:monospace}
      .totals-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}
      .words-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
      .words-value{font-weight:600;color:#333;font-size:11px;line-height:1.5}
      .remarks-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;margin-top:16px}
      .remarks-value{font-size:11px;color:#555;font-style:italic}
      .totals-box{display:flex;flex-direction:column;gap:8px}
      .total-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid #eee}
      .total-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#777}
      .total-amount{font-family:monospace;font-weight:700;font-size:12px}
      .grand-row{display:flex;justify-content:space-between;align-items:center;padding-top:4px}
      .grand-label{font-size:12px;font-weight:800;text-transform:uppercase}
      .grand-amount{font-family:monospace;font-weight:800;font-size:16px;color:#111}
      .footer{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:32px;padding-top:20px;border-top:1px solid #ddd}
      .tc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
      .tc-text{font-size:10px;color:#666;line-height:1.6}
      .sign-block{text-align:right;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end}
      .sign-for{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
      .sign-line{border-top:1px solid #111;width:180px;padding-top:4px;text-align:center;margin-top:48px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
    </style></head><body><div class="inv">
      <div class="title">${isSale ? "Tax Invoice" : "Purchase Invoice"}</div>
      <div class="header">
        <div>
          <div class="co-name">${company.companyName}</div>
          <div class="co-addr">${company.address || "No Address Added"}</div>
          <div class="co-gst">GSTIN: ${company.gstNo || "N/A"}</div>
        </div>
        <div class="inv-meta">
          <div class="meta-label">Invoice Number</div>
          <div class="meta-value">${voucher.voucherNo}</div>
          <div class="meta-label" style="margin-top:12px">Date</div>
          <div class="meta-value">${voucher.voucherDate}</div>
        </div>
      </div>
      <div class="bill-section">
        <div class="section-label">${isSale ? "Bill To (Buyer)" : "Bill From (Seller)"}</div>
        <div class="party-name">${party.name}</div>
        <div class="party-addr">${party.address || "No Address Added"}</div>
        <div class="party-gst">GSTIN: ${party.gstNo || "N/A"}</div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:left">Item</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">GST%</th>
          <th class="text-right">GST Amt</th>
          <th class="text-right">Amount</th>
        </tr></thead>
        <tbody>${lines.map(l => {
      const gstAmt = (l.amount * l.gstPercent) / 100;
      return `<tr>
            <td><div class="inventory-name">${l.inventoryName}</div><div class="inventory-code">${l.inventoryCode}</div></td>
            <td class="text-right mono">${l.quantity.toFixed(2)} ${l.unit}</td>
            <td class="text-right mono">${fmt(l.rate)}</td>
            <td class="text-right mono">${l.gstPercent}%</td>
            <td class="text-right mono">${fmt(gstAmt)}</td>
            <td class="text-right mono" style="font-weight:700">${fmt(l.amount)}</td>
          </tr>`;
    }).join("")}</tbody>
      </table>
      <div class="totals-grid">
        <div>
          <div class="words-label">Amount in Words</div>
          <div class="words-value">${numberToWords(voucher.netAmount)}</div>
          ${voucher.remarks ? `<div class="remarks-label">Remarks</div><div class="remarks-value">${voucher.remarks}</div>` : ""}
        </div>
        <div class="totals-box">
          <div class="total-row"><span class="total-label">Taxable Subtotal</span><span class="total-amount">${fmt(voucher.totalAmount)}</span></div>
          <div class="total-row"><span class="total-label">GST Tax (${isSale ? "Collected" : "Paid"})</span><span class="total-amount">${fmt(voucher.taxAmount)}</span></div>
          ${(voucher.extraChargesData && voucher.extraChargesData.length > 0
            ? voucher.extraChargesData.map(c => `<div class="total-row"><span class="total-label">${c.label || "Extra Charges"}</span><span class="total-amount">+${fmt(c.type === "percentage" ? (voucher.totalAmount + voucher.taxAmount) * Number(c.value) / 100 : Number(c.value))}</span></div>`).join("")
            : Number(voucher.extraCharges) > 0 ? `<div class="total-row"><span class="total-label">Extra Charges</span><span class="total-amount">+${fmt(Number(voucher.extraCharges))}</span></div>` : ""
          )}
          <div class="grand-row"><span class="grand-label">Grand Total</span><span class="grand-amount">${fmt(voucher.netAmount)}</span></div>
        </div>
      </div>
      <div class="footer">
        <div>
          <div class="tc-label">Terms &amp; Conditions</div>
          <div class="tc-text">1. Goods once sold will not be returned or exchanged.<br/>2. Subject to local jurisdiction only.</div>
        </div>
        <div class="sign-block">
          <div class="sign-for">For ${company.companyName}</div>
          <div class="sign-line">Authorized Signatory</div>
        </div>
      </div>
    </div></body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const savePDF = () => {
    const el = printRef.current;
    if (!el) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${voucher.voucherNo}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;background:#fff;padding:24px}
      .inv{max-width:760px;margin:0 auto;border:1px solid #ddd;padding:32px}
      .title{text-align:center;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding-bottom:12px;border-bottom:2px solid #111;margin-bottom:20px}
      .header{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:16px;border-bottom:1px solid #ddd;margin-bottom:16px}
      .co-name{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
      .co-addr{color:#555;font-size:11px;margin-top:4px;white-space:pre-wrap}
      .co-gst{font-family:monospace;font-weight:700;font-size:11px;margin-top:6px}
      .inv-meta{text-align:right}
      .meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
      .meta-value{font-size:13px;font-weight:800;font-family:monospace;margin-top:2px}
      .bill-section{padding-bottom:16px;border-bottom:1px solid #ddd;margin-bottom:16px}
      .section-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
      .party-name{font-size:13px;font-weight:800;text-transform:uppercase}
      .party-addr{color:#555;font-size:11px;margin-top:3px;white-space:pre-wrap}
      .party-gst{font-family:monospace;font-weight:700;font-size:11px;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;padding:8px 6px;border-bottom:2px solid #111;white-space:nowrap}
      td{padding:10px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
      .inventory-name{font-weight:700;color:#111}
      .inventory-code{font-family:monospace;font-size:10px;color:#888;margin-top:2px}
      .text-right{text-align:right}
      .mono{font-family:monospace}
      .totals-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px}
      .words-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
      .words-value{font-weight:600;color:#333;font-size:11px;line-height:1.5}
      .remarks-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;margin-top:16px}
      .remarks-value{font-size:11px;color:#555;font-style:italic}
      .totals-box{display:flex;flex-direction:column;gap:8px}
      .total-row{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid #eee}
      .total-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#777}
      .total-amount{font-family:monospace;font-weight:700;font-size:12px}
      .grand-row{display:flex;justify-content:space-between;align-items:center;padding-top:4px}
      .grand-label{font-size:12px;font-weight:800;text-transform:uppercase}
      .grand-amount{font-family:monospace;font-weight:800;font-size:16px;color:#111}
      .footer{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:32px;padding-top:20px;border-top:1px solid #ddd}
      .tc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px}
      .tc-text{font-size:10px;color:#666;line-height:1.6}
      .sign-block{text-align:right;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end}
      .sign-for{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
      .sign-line{border-top:1px solid #111;width:180px;padding-top:4px;text-align:center;margin-top:48px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888}
      @media print{@page{size:A4;margin:20mm}}
    </style></head><body><div class="inv">
      <div class="title">${isSale ? "Tax Invoice" : "Purchase Invoice"}</div>
      <div class="header">
        <div>
          <div class="co-name">${company.companyName}</div>
          <div class="co-addr">${company.address || "No Address Added"}</div>
          <div class="co-gst">GSTIN: ${company.gstNo || "N/A"}</div>
        </div>
        <div class="inv-meta">
          <div class="meta-label">Invoice Number</div>
          <div class="meta-value">${voucher.voucherNo}</div>
          <div class="meta-label" style="margin-top:12px">Date</div>
          <div class="meta-value">${voucher.voucherDate}</div>
        </div>
      </div>
      <div class="bill-section">
        <div class="section-label">${isSale ? "Bill To (Buyer)" : "Bill From (Seller)"}</div>
        <div class="party-name">${party.name}</div>
        <div class="party-addr">${party.address || "No Address Added"}</div>
        <div class="party-gst">GSTIN: ${party.gstNo || "N/A"}</div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:left">Item</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Rate</th>
          <th class="text-right">GST%</th>
          <th class="text-right">GST Amt</th>
          <th class="text-right">Amount</th>
        </tr></thead>
        <tbody>${lines.map(l => {
      const gstAmt = (l.amount * l.gstPercent) / 100;
      return `<tr>
            <td><div class="inventory-name">${l.inventoryName}</div><div class="inventory-code">${l.inventoryCode}</div></td>
            <td class="text-right mono">${l.quantity.toFixed(2)} ${l.unit}</td>
            <td class="text-right mono">${fmt(l.rate)}</td>
            <td class="text-right mono">${l.gstPercent}%</td>
            <td class="text-right mono">${fmt(gstAmt)}</td>
            <td class="text-right mono" style="font-weight:700">${fmt(l.amount)}</td>
          </tr>`;
    }).join("")}</tbody>
      </table>
      <div class="totals-grid">
        <div>
          <div class="words-label">Amount in Words</div>
          <div class="words-value">${numberToWords(voucher.netAmount)}</div>
          ${voucher.remarks ? `<div class="remarks-label">Remarks</div><div class="remarks-value">${voucher.remarks}</div>` : ""}
        </div>
        <div class="totals-box">
          <div class="total-row"><span class="total-label">Subtotal</span><span class="total-amount">${fmt(voucher.totalAmount)}</span></div>
          ${(voucher.extraChargesData && voucher.extraChargesData.length > 0
            ? voucher.extraChargesData.map(c => {
                const isLess = c.effect === "less";
                const amt = c.type === "percentage" ? voucher.totalAmount * Number(c.value) / 100 : Number(c.value);
                return `<div class="total-row"><span class="total-label">${c.label || (isLess ? "Deduction" : "Extra Charge")}</span><span class="total-amount">${isLess ? "-" : "+"}${fmt(amt)}</span></div>`;
              }).join("")
            : Number(voucher.extraCharges) !== 0 ? `<div class="total-row"><span class="total-label">${Number(voucher.extraCharges) < 0 ? "Deduction" : "Extra Charge"}</span><span class="total-amount">${Number(voucher.extraCharges) < 0 ? "-" : "+"}${fmt(Math.abs(Number(voucher.extraCharges)))}</span></div>` : ""
          )}
          <div class="total-row"><span class="total-label">Total Taxable Value</span><span class="total-amount">${fmt(voucher.totalAmount + (Number(voucher.extraCharges) || 0))}</span></div>
          <div class="total-row"><span class="total-label">GST Tax (${isSale ? "Collected" : "Paid"})</span><span class="total-amount">${fmt(voucher.taxAmount)}</span></div>
          <div class="grand-row"><span class="grand-label">Grand Total</span><span class="grand-amount">${fmt(voucher.netAmount)}</span></div>
        </div>
      </div>
      <div class="footer">
        <div>
          <div class="tc-label">Terms &amp; Conditions</div>
          <div class="tc-text">1. Goods once sold will not be returned or exchanged.<br/>2. Subject to local jurisdiction only.</div>
        </div>
        <div class="sign-block">
          <div class="sign-for">For ${company.companyName}</div>
          <div class="sign-line">Authorized Signatory</div>
        </div>
      </div>
    </div></body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay to ensure content renders before print dialog (which offers "Save as PDF")
    setTimeout(() => win.print(), 500);
  };

  const gstAmountPerLine = (line: InvoiceLine) => (line.amount * line.gstPercent) / 100;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full sm:data-[side=right]:w-[45%] sm:max-w-5xl p-0 flex flex-col gap-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Invoice Preview
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={savePDF} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Save as PDF
            </Button>
            <Button size="sm" onClick={triggerPrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable invoice area */}
        <div className="overflow-y-auto flex-1 bg-muted/30 p-6">
          <div
            ref={printRef}
            className="mx-auto bg-white text-black shadow-lg border border-gray-200"
            style={{ maxWidth: 760, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 13 }}
          >
            <div style={{ padding: 40 }}>
              {/* Invoice Title */}
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", paddingBottom: 12, borderBottom: "2px solid #111", marginBottom: 20 }}>
                {isSale ? "Tax Invoice" : "Purchase Invoice"}
              </div>

              {/* Header: Company + Invoice Meta */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingBottom: 16, borderBottom: "1px solid #e5e5e5", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{company.companyName}</div>
                  <div style={{ color: "#555", fontSize: 11, marginTop: 4, whiteSpace: "pre-wrap" }}>{company.address || "No Address Added"}</div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, marginTop: 6 }}>GSTIN: {company.gstNo || "N/A"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Invoice Number</div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", marginTop: 2 }}>{voucher.voucherNo}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginTop: 12 }}>Date</div>
                  <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", marginTop: 2 }}>{voucher.voucherDate}</div>
                </div>
              </div>

              {/* Bill To */}
              <div style={{ paddingBottom: 16, borderBottom: "1px solid #e5e5e5", marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 6 }}>
                  {isSale ? "Bill To (Buyer)" : "Bill From (Seller)"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase" }}>{party.name}</div>
                <div style={{ color: "#555", fontSize: 11, marginTop: 3, whiteSpace: "pre-wrap" }}>{party.address || "No Address Added"}</div>
                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, marginTop: 4 }}>GSTIN: {party.gstNo || "N/A"}</div>
              </div>

              {/* Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #111" }}>
                    {["Item", "Qty", "Rate", "GST %", "GST Amt", "Amount"].map((h, i) => (
                      <th key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", padding: "8px 8px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, color: "#111", fontSize: 12 }}>{line.inventoryName}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#888", marginTop: 2 }}>{line.inventoryCode}</div>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, verticalAlign: "top", whiteSpace: "nowrap" }}>{line.quantity.toFixed(2)} {line.unit}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, verticalAlign: "top", whiteSpace: "nowrap" }}>{fmt(line.rate)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, verticalAlign: "top" }}>{line.gstPercent}%</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, verticalAlign: "top", whiteSpace: "nowrap" }}>{fmt(gstAmountPerLine(line))}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12, verticalAlign: "top", whiteSpace: "nowrap" }}>{fmt(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Words */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 6 }}>Amount in Words</div>
                  <div style={{ fontWeight: 600, color: "#333", fontSize: 12, lineHeight: 1.6 }}>{numberToWords(voucher.netAmount)}</div>
                  {voucher.remarks && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 4 }}>Remarks</div>
                      <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>{voucher.remarks}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #eee" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#777" }}>Taxable Subtotal</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{fmt(voucher.totalAmount)}</span>
                  </div>
                  {(voucher.extraChargesData && voucher.extraChargesData.length > 0
                    ? voucher.extraChargesData.map(c => ({
                        label: c.label,
                        value: c.value,
                        type: c.type,
                        effect: c.effect
                      }))
                    : Number(voucher.extraCharges) !== 0 ? [{ label: Number(voucher.extraCharges) < 0 ? "Deduction" : "Extra Charge", value: String(Math.abs(Number(voucher.extraCharges))), type: "value" as const, effect: Number(voucher.extraCharges) < 0 ? "less" as const : "add" as const }] : []
                  ).map((c, i) => {
                    const isLess = c.effect === "less";
                    const amt = c.type === "percentage" ? voucher.totalAmount * Number(c.value) / 100 : Number(c.value);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #eee" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#777" }}>{c.label || (isLess ? "Deduction" : "Extra Charge")}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{isLess ? "-" : "+"}{fmt(amt)}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #eee" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#777" }}>Total Taxable Value</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{fmt(voucher.totalAmount + (Number(voucher.extraCharges) || 0))}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #eee" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#777" }}>GST Tax ({isSale ? "Collected" : "Paid"})</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{fmt(voucher.taxAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>Grand Total</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18 }}>{fmt(voucher.netAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Footer: T&C + Signature */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 40, paddingTop: 20, borderTop: "1px solid #ddd" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 6 }}>Terms & Conditions</div>
                  <div style={{ fontSize: 10, color: "#666", lineHeight: 1.7 }}>
                    1. Goods once sold will not be returned or exchanged.<br />
                    2. Subject to local jurisdiction only.
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>For {company.companyName}</div>
                  <div style={{ borderTop: "1px solid #111", width: 180, paddingTop: 4, textAlign: "center", marginTop: 56, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
