"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface TaxRate { taxRateId: number; taxName: string; taxPercent: string; }
interface Product {
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  gstRateId: number | null;
  openingStockQty: string;
  openingStockRate: string;
  taxName?: string | null;
  taxPercent?: string | null;
}

const EMPTY = { productCode: "", productName: "", unit: "", gstRateId: "", openingStockQty: "0", openingStockRate: "0" };
const UNITS = ["MTR", "KG", "PCS", "BOX", "ROLL", "SET", "PAIR", "LTR"];

export default function ProductsClient({
  initialData, taxRates, canCreate, canUpdate, canDelete, canExport,
}: {
  initialData: Product[];
  taxRates: TaxRate[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.productName.toLowerCase().includes(search.toLowerCase()) ||
    r.productCode.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setSheetOpen(true); }
  function openEdit(row: Product) {
    setEditing(row);
    setForm({ productCode: row.productCode, productName: row.productName, unit: row.unit, gstRateId: row.gstRateId ? String(row.gstRateId) : "", openingStockQty: row.openingStockQty, openingStockRate: row.openingStockRate });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.productCode || !form.productName || !form.unit) return;
    setSaving(true);
    const url = editing ? `/api/products/${editing.productId}` : "/api/products";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, gstRateId: form.gstRateId ? Number(form.gstRateId) : null, openingStockQty: Number(form.openingStockQty), openingStockRate: Number(form.openingStockRate) }),
    });
    const row = await res.json();
    const tax = taxRates.find((t) => t.taxRateId === Number(form.gstRateId));
    const enriched = { ...row, taxName: tax?.taxName ?? null, taxPercent: tax?.taxPercent ?? null };
    if (editing) setData((d) => d.map((r) => (r.productId === editing.productId ? enriched : r)));
    else setData((d) => [...d, enriched]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/products/${deleteTarget.productId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.productId !== deleteTarget.productId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Products</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} product{data.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-products" placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-52 text-xs" />
          <ExportButton
            filename="products.csv"
            headers={["Product Code", "Product Name", "Unit", "Opening Qty", "Opening Rate"]}
            keys={["productCode", "productName", "unit", "openingStockQty", "openingStockRate"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate} size="sm">+ Add Product</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Code</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unit</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GST</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opening Qty</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">{search ? "No products match." : "No products yet."}</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.productId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.productCode}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.productName}</td>
                <td className="px-4 py-3 text-xs"><Badge variant="secondary">{row.unit}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.taxName ? `${row.taxName} (${row.taxPercent}%)` : "—"}</td>
                <td className="px-4 py-3 text-right text-xs text-foreground">{Number(row.openingStockQty).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-xs text-foreground">₹{Number(row.openingStockRate).toFixed(2)}</td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {canUpdate && <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(row)} className="text-danger hover:text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Product" : "New Product"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product Code</Label>
              <Input id="productCode" placeholder="FAB-001" value={form.productCode} onChange={(e) => setForm((f) => ({ ...f, productCode: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product Name</Label>
              <Input id="productName" placeholder="Cotton Fabric 40s" value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger id="unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">GST Rate</Label>
              <Select value={form.gstRateId} onValueChange={(v) => setForm((f) => ({ ...f, gstRateId: v }))}>
                <SelectTrigger id="gstRateId"><SelectValue placeholder="Select GST rate" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {taxRates.map((t) => <SelectItem key={t.taxRateId} value={String(t.taxRateId)}>{t.taxName} ({t.taxPercent}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Opening Qty</Label>
                <Input id="openingStockQty" type="number" step={0.01} value={form.openingStockQty} onChange={(e) => setForm((f) => ({ ...f, openingStockQty: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate (₹)</Label>
                <Input id="openingStockRate" type="number" step={0.01} value={form.openingStockRate} onChange={(e) => setForm((f) => ({ ...f, openingStockRate: e.target.value }))} />
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.productCode || !form.productName || !form.unit}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.productName}</span>?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
