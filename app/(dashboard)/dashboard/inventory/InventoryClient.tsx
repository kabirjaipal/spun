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
interface InventoryItem {
  inventoryId: number;
  inventoryCode: string;
  inventoryName: string;
  unit: string;
  gstRateId: number | null;
  openingStockQty: string;
  openingStockRate: string;
  taxName?: string | null;
  taxPercent?: string | null;
  hsnCode?: string | null;
  inventoryGroupId?: number | null;
  inventoryCategoryId?: number | null;
  gstType?: string | null;
  gstPercent?: string | null;
  isConsumable: boolean;
  consumeWithInventoryId?: number | null;
  consumptionRatio?: string | null;
  shortagePercent?: string | null;
}

interface InventoryGroup { inventoryGroupId: number; groupName: string; }
interface InventoryCategory { inventoryCategoryId: number; categoryName: string; }
interface UnitOfMeasurement { unitId: number; unitCode: string; unitName: string; }

const EMPTY = {
  inventoryCode: "",
  inventoryName: "",
  unit: "",
  gstRateId: "",
  openingStockQty: "0",
  openingStockRate: "0",
  hsnCode: "",
  inventoryGroupId: "",
  inventoryCategoryId: "",
  gstType: "state",
  gstPercent: "0",
  isConsumable: false,
  consumeWithInventoryId: "",
  consumptionRatio: "0",
  shortagePercent: "0",
};

export default function InventoryClient({
  initialData, taxRates, inventoryGroups, inventoryCategories, unitsList, canCreate, canUpdate, canDelete, canExport,
}: {
  initialData: InventoryItem[];
  taxRates: TaxRate[];
  inventoryGroups: InventoryGroup[];
  inventoryCategories: InventoryCategory[];
  unitsList: UnitOfMeasurement[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.inventoryName.toLowerCase().includes(search.toLowerCase()) ||
    r.inventoryCode.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setSheetOpen(true); }
  function openEdit(row: InventoryItem) {
    setEditing(row);
    setForm({
      inventoryCode: row.inventoryCode,
      inventoryName: row.inventoryName,
      unit: row.unit,
      gstRateId: row.gstRateId ? String(row.gstRateId) : "",
      openingStockQty: row.openingStockQty,
      openingStockRate: row.openingStockRate,
      hsnCode: row.hsnCode || "",
      inventoryGroupId: row.inventoryGroupId ? String(row.inventoryGroupId) : "",
      inventoryCategoryId: row.inventoryCategoryId ? String(row.inventoryCategoryId) : "",
      gstType: row.gstType || "state",
      gstPercent: row.gstPercent || "0",
      isConsumable: row.isConsumable,
      consumeWithInventoryId: row.consumeWithInventoryId ? String(row.consumeWithInventoryId) : "",
      consumptionRatio: row.consumptionRatio || "0",
      shortagePercent: row.shortagePercent || "0",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.inventoryCode || !form.inventoryName || !form.unit) return;
    setSaving(true);
    const url = editing ? `/api/inventory/${editing.inventoryId}` : "/api/inventory";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        gstRateId: form.gstRateId ? Number(form.gstRateId) : null,
        openingStockQty: Number(form.openingStockQty),
        openingStockRate: Number(form.openingStockRate),
        inventoryGroupId: form.inventoryGroupId ? Number(form.inventoryGroupId) : null,
        inventoryCategoryId: form.inventoryCategoryId ? Number(form.inventoryCategoryId) : null,
        consumeWithInventoryId: form.consumeWithInventoryId ? Number(form.consumeWithInventoryId) : null,
        consumptionRatio: Number(form.consumptionRatio),
        shortagePercent: Number(form.shortagePercent),
        gstPercent: Number(form.gstPercent),
      }),
    });
    const row = await res.json();
    const tax = taxRates.find((t) => t.taxRateId === Number(form.gstRateId));
    const enriched = {
      ...row,
      taxName: tax?.taxName ?? null,
      taxPercent: tax?.taxPercent ?? null,
      openingStockQty: String(row.openingStockQty),
      openingStockRate: String(row.openingStockRate),
      gstPercent: row.gstPercent ? String(row.gstPercent) : null,
      consumptionRatio: row.consumptionRatio ? String(row.consumptionRatio) : null,
      shortagePercent: row.shortagePercent ? String(row.shortagePercent) : null,
    };
    if (editing) setData((d) => d.map((r) => (r.inventoryId === editing.inventoryId ? enriched : r)));
    else setData((d) => [...d, enriched]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/inventory/${deleteTarget.inventoryId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.inventoryId !== deleteTarget.inventoryId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Inventory</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} item{data.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-inventory" placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
          <ExportButton
            filename="inventory.csv"
            headers={["Inventory Code", "Inventory Name", "Unit", "Opening Qty", "Opening Rate", "Type"]}
            keys={["inventoryCode", "inventoryName", "unit", "openingStockQty", "openingStockRate", "isConsumable"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Item</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GST Details</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Opening Qty</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Rate</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{search ? "No items match." : "No inventory items yet."}</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.inventoryId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.inventoryCode}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.inventoryName}</td>
                <td className="px-4 py-3 text-xs">
                  <Badge variant={row.isConsumable ? "secondary" : "default"}>
                    {row.isConsumable ? "Consumable" : "Selling"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs"><Badge variant="secondary">{row.unit}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {row.gstType ? `${row.gstType.toUpperCase()} (${row.gstPercent}%)` : row.taxName ? `${row.taxName} (${row.taxPercent}%)` : "—"}
                </td>
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
        <SheetContent className="overflow-y-auto w-[420px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Item" : "New Item"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 px-1 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Code</Label>
                <Input id="inventoryCode" placeholder="FAB-001" value={form.inventoryCode} onChange={(e) => setForm((f) => ({ ...f, inventoryCode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Name</Label>
                <Input id="inventoryName" placeholder="Cotton Fabric 40s" value={form.inventoryName} onChange={(e) => setForm((f) => ({ ...f, inventoryName: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HSN Code</Label>
                <Input id="hsnCode" placeholder="e.g. 5208" value={form.hsnCode} onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger id="unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{unitsList.map((u) => <SelectItem key={u.unitCode} value={u.unitCode}>{u.unitCode} - {u.unitName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory Group</Label>
                <Select value={form.inventoryGroupId} onValueChange={(v) => setForm((f) => ({ ...f, inventoryGroupId: v }))}>
                  <SelectTrigger id="inventoryGroupId"><SelectValue placeholder="Select Group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {inventoryGroups.map((g) => <SelectItem key={g.inventoryGroupId} value={String(g.inventoryGroupId)}>{g.groupName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory Category</Label>
                <Select value={form.inventoryCategoryId} onValueChange={(v) => setForm((f) => ({ ...f, inventoryCategoryId: v }))}>
                  <SelectTrigger id="inventoryCategoryId"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {inventoryCategories.map((c) => <SelectItem key={c.inventoryCategoryId} value={String(c.inventoryCategoryId)}>{c.categoryName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground">GST & Tax Settings</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">GST Type</Label>
                  <Select value={form.gstType} onValueChange={(v) => setForm((f) => ({ ...f, gstType: v }))}>
                    <SelectTrigger id="gstType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="state">State GST</SelectItem>
                      <SelectItem value="center">Center GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">GST %</Label>
                  <Input id="gstPercent" type="number" step={0.01} value={form.gstPercent} onChange={(e) => setForm((f) => ({ ...f, gstPercent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Tally Tax Rate</Label>
                  <Select value={form.gstRateId} onValueChange={(v) => setForm((f) => ({ ...f, gstRateId: v }))}>
                    <SelectTrigger id="gstRateId"><SelectValue placeholder="Select rate" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {taxRates.map((t) => <SelectItem key={t.taxRateId} value={String(t.taxRateId)}>{t.taxName} ({t.taxPercent}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-foreground">Stock Type & Consumption</Label>
              <div className="flex items-center gap-6 py-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input type="radio" name="isConsumable" checked={!form.isConsumable} onChange={() => setForm((f) => ({ ...f, isConsumable: false }))} className="w-4 h-4 accent-primary" />
                  Selling Good
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input type="radio" name="isConsumable" checked={form.isConsumable} onChange={() => setForm((f) => ({ ...f, isConsumable: true }))} className="w-4 h-4 accent-primary" />
                  Consumable Good
                </label>
              </div>

              {form.isConsumable && (
                <div className="p-3 bg-muted/40 rounded-lg space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Consume With (Associated Item)</Label>
                    <Select value={form.consumeWithInventoryId} onValueChange={(v) => setForm((f) => ({ ...f, consumeWithInventoryId: v }))}>
                      <SelectTrigger id="consumeWithInventoryId"><SelectValue placeholder="Select Item" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {data.filter((p) => p.inventoryId !== editing?.inventoryId).map((p) => (
                          <SelectItem key={p.inventoryId} value={String(p.inventoryId)}>{p.inventoryName} ({p.inventoryCode})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Consumption Ratio</Label>
                      <Input id="consumptionRatio" type="number" step={0.0001} placeholder="e.g. 3.0" value={form.consumptionRatio} onChange={(e) => setForm((f) => ({ ...f, consumptionRatio: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Shortage Percentage (%)</Label>
                      <Input id="shortagePercent" type="number" step={0.01} placeholder="e.g. 5" value={form.shortagePercent} onChange={(e) => setForm((f) => ({ ...f, shortagePercent: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening Qty</Label>
                <Input id="openingStockQty" type="number" step={0.01} value={form.openingStockQty} onChange={(e) => setForm((f) => ({ ...f, openingStockQty: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate (₹)</Label>
                <Input id="openingStockRate" type="number" step={0.01} value={form.openingStockRate} onChange={(e) => setForm((f) => ({ ...f, openingStockRate: e.target.value }))} />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.inventoryCode || !form.inventoryName || !form.unit}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Item</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.inventoryName}</span>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
