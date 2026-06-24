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

interface Customer {
  customerId: number;
  customerName: string;
  gstNo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalance: string;
}

const EMPTY_FORM = { customerName: "", gstNo: "", phone: "", email: "", address: "", openingBalance: "0" };

const FIELDS = [
  { id: "customerName", label: "Customer Name", placeholder: "ABC Textiles" },
  { id: "gstNo", label: "GSTIN", placeholder: "27AAPFU0939F1ZV" },
  { id: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { id: "email", label: "Email", placeholder: "contact@abctextiles.com" },
  { id: "address", label: "Address", placeholder: "123, Fabric Market, Surat" },
] as const;

export default function CustomersClient({
  initialData,
  canCreate,
  canUpdate,
  canDelete,
  canExport,
}: {
  initialData: Customer[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (r.gstNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.phone ?? "").includes(search)
  );

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setSheetOpen(true); }
  function openEdit(row: Customer) {
    setEditing(row);
    setForm({ customerName: row.customerName, gstNo: row.gstNo ?? "", phone: row.phone ?? "", email: row.email ?? "", address: row.address ?? "", openingBalance: row.openingBalance });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.customerName) return;
    setSaving(true);
    const url = editing ? `/api/customers/${editing.customerId}` : "/api/customers";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) }),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.customerId === editing.customerId ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/customers/${deleteTarget.customerId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.customerId !== deleteTarget.customerId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Customers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} customer{data.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-customers" placeholder="Search name, GST, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
          <ExportButton
            filename="customers.csv"
            headers={["Customer Name", "GSTIN", "Phone", "Email", "Address", "Opening Balance"]}
            keys={["customerName", "gstNo", "phone", "email", "address", "openingBalance"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Customer</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GSTIN</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
              <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Opening Bal.</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? "No customers match your search." : "No customers yet. Add your first one."}
              </td></tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.customerId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.customerName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{row.gstNo || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.phone || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant={Number(row.openingBalance) >= 0 ? "secondary" : "destructive"} className="text-xs font-mono">
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
            <SheetTitle>{editing ? "Edit Customer" : "New Customer"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {FIELDS.map(({ id, label, placeholder }) => (
              <div key={id} className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                <Input id={id} placeholder={placeholder} value={(form as any)[id]} onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance (₹)</Label>
              <Input id="openingBalance" type="number" step={0.01} value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} />
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.customerName}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Customer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.customerName}</span>? Their ledger will also be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
