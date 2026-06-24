"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface Supplier {
  supplierId: number;
  supplierName: string;
  gstNo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalance: string;
}

const EMPTY = { supplierName: "", gstNo: "", phone: "", email: "", address: "", openingBalance: "0" };
const FIELDS = [
  { id: "supplierName", label: "Supplier Name", placeholder: "XYZ Fabrics Pvt Ltd" },
  { id: "gstNo", label: "GSTIN", placeholder: "24XXXXX0000X1ZX" },
  { id: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { id: "email", label: "Email", placeholder: "supplier@example.com" },
  { id: "address", label: "Address", placeholder: "Ring Road, Surat" },
] as const;

export default function SuppliersClient({
  initialData, canCreate, canUpdate, canDelete, canExport,
}: {
  initialData: Supplier[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.supplierName.toLowerCase().includes(search.toLowerCase()) ||
    (r.gstNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.phone ?? "").includes(search)
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setSheetOpen(true); }
  function openEdit(row: Supplier) {
    setEditing(row);
    setForm({ supplierName: row.supplierName, gstNo: row.gstNo ?? "", phone: row.phone ?? "", email: row.email ?? "", address: row.address ?? "", openingBalance: row.openingBalance });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.supplierName) return;
    setSaving(true);
    const url = editing ? `/api/suppliers/${editing.supplierId}` : "/api/suppliers";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) }),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.supplierId === editing.supplierId ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/suppliers/${deleteTarget.supplierId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.supplierId !== deleteTarget.supplierId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Suppliers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} supplier{data.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-suppliers" placeholder="Search name, GST, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-60 text-xs" />
          <ExportButton
            filename="suppliers.csv"
            headers={["Supplier Name", "GSTIN", "Phone", "Email", "Address", "Opening Balance"]}
            keys={["supplierName", "gstNo", "phone", "email", "address", "openingBalance"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate} size="sm">+ Add Supplier</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">GSTIN</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opening Bal.</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? "No suppliers match your search." : "No suppliers yet. Add your first one."}
              </td></tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.supplierId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.supplierName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{row.gstNo || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.phone || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    ₹{Number(row.openingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Badge>
                </td>
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
            <SheetTitle>{editing ? "Edit Supplier" : "New Supplier"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {FIELDS.map(({ id, label, placeholder }) => (
              <div key={id} className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                <Input id={id} placeholder={placeholder} value={(form as any)[id]} onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance (₹)</Label>
              <Input id="openingBalance" type="number" step={0.01} value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} />
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.supplierName}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Supplier</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.supplierName}</span>? Their ledger will also be removed.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
