"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface Mill {
  millId: number;
  millName: string;
  address: string | null;
  gstNo: string | null;
  gstType: string | null;
  city: string | null;
  stateCode: string | null;
  phone: string | null;
  msmeRegistered: boolean;
  msmeType: string | null;
}

interface Props {
  initialData: Mill[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

const EMPTY = {
  millName: "",
  address: "",
  gstNo: "",
  gstType: "unregistered",
  city: "",
  stateCode: "",
  phone: "",
  msmeRegistered: false,
  msmeType: "non_registered",
};

export default function MillsClient({ initialData, canCreate, canUpdate, canDelete, canExport }: Props) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Mill | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Mill | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.millName.toLowerCase().includes(search.toLowerCase()) ||
    (r.gstNo && r.gstNo.toLowerCase().includes(search.toLowerCase()))
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setSheetOpen(true);
  }

  function openEdit(row: Mill) {
    setEditing(row);
    setForm({
      millName: row.millName,
      address: row.address || "",
      gstNo: row.gstNo || "",
      gstType: row.gstType || "unregistered",
      city: row.city || "",
      stateCode: row.stateCode || "",
      phone: row.phone || "",
      msmeRegistered: row.msmeRegistered,
      msmeType: row.msmeType || "non_registered",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.millName.trim()) return;
    setSaving(true);
    const url = editing ? `/api/mills/${editing.millId}` : "/api/mills";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        millName: form.millName.trim(),
        gstNo: form.gstNo ? form.gstNo.trim().toUpperCase() : null,
      }),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.millId === editing.millId ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/mills/${deleteTarget.millId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.millId !== deleteTarget.millId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Mills</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} mill{data.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder="Search mill..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
          <ExportButton
            filename="mills.csv"
            headers={["Mill Name", "GSTIN", "GST Type", "Phone", "MSME Type"]}
            keys={["millName", "gstNo", "gstType", "phone", "msmeType"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Mill</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Mill Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GSTIN</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">City</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">MSME Status</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No mills found.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.millId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{row.millName}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.gstNo || "—"}</td>
                <td className="px-4 py-3 text-foreground">{row.city || "—"}</td>
                <td className="px-4 py-3 text-xs">
                  <Badge variant={row.msmeRegistered ? "default" : "secondary"}>
                    {row.msmeRegistered ? `${row.msmeType?.replace("_", " ").toUpperCase()}` : "Not Registered"}
                  </Badge>
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {canUpdate && (
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(row)} className="text-danger hover:text-danger hover:bg-danger/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
            <SheetTitle>{editing ? "Edit Mill" : "New Mill"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label>Mill Name</Label>
              <Input id="millName" placeholder="e.g. Surat Textile Mill" value={form.millName} onChange={(e) => setForm((f) => ({ ...f, millName: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input id="address" placeholder="456 Industrial Area" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input id="gstNo" placeholder="24AAAAA1111A1Z1" value={form.gstNo} onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>GST Type</Label>
                <Select value={form.gstType} onValueChange={(v) => setForm((f) => ({ ...f, gstType: v }))}>
                  <SelectTrigger id="gstType"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="composition">Composition</SelectItem>
                    <SelectItem value="unregistered">Unregistered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input id="city" placeholder="Surat" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>State Code</Label>
                <Input id="stateCode" placeholder="24" value={form.stateCode} onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input id="phone" placeholder="9876543210" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="msmeRegistered" checked={form.msmeRegistered} onChange={(e) => setForm((f) => ({ ...f, msmeRegistered: e.target.checked }))} className="w-4 h-4 accent-primary rounded" />
                <Label htmlFor="msmeRegistered" className="cursor-pointer">MSME Registered?</Label>
              </div>

              {form.msmeRegistered && (
                <div className="space-y-2">
                  <Label>MSME Type</Label>
                  <Select value={form.msmeType} onValueChange={(v) => setForm((f) => ({ ...f, msmeType: v }))}>
                    <SelectTrigger id="msmeType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">Micro</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.millName.trim()}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving
                </>
              ) : editing ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Delete Mill</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.millName}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
