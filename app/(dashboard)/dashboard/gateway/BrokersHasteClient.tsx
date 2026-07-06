"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, User, Truck } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface BrokerHaste {
  id: number;
  name: string;
  type: string;
  panCard?: string | null;
  gst?: string | null;
  address?: string | null;
  phone?: string | null;
}

interface Props {
  initialData: BrokerHaste[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

const EMPTY = {
  name: "",
  type: "broker" as "broker" | "haste",
  panCard: "",
  gst: "",
  address: "",
  phone: "",
};

export default function BrokersHasteClient({ initialData, canCreate, canUpdate, canDelete, canExport }: Props) {
  const [data, setData] = useState(initialData);
  const [activeType, setActiveType] = useState<"broker" | "haste">("broker");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerHaste | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<BrokerHaste | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data
    .filter((r) => r.type === activeType)
    .filter((r) =>
      r.name.toLowerCase().includes(search.toLowerCase())
    );

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      type: activeType,
      panCard: "",
      gst: "",
      address: "",
      phone: "",
    });
    setSheetOpen(true);
  }

  function openEdit(row: BrokerHaste) {
    setEditing(row);
    setForm({
      name: row.name,
      type: row.type as "broker" | "haste",
      panCard: row.panCard || "",
      gst: row.gst || "",
      address: row.address || "",
      phone: row.phone || "",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editing ? `/api/brokers-haste/${editing.id}` : "/api/brokers-haste";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        type: form.type,
        panCard: form.type === "broker" && form.panCard.trim() ? form.panCard.trim() : null,
        gst: form.type === "broker" && form.gst.trim() ? form.gst.trim() : null,
        address: form.type === "broker" && form.address.trim() ? form.address.trim() : null,
        phone: form.type === "broker" && form.phone.trim() ? form.phone.trim() : null,
      }),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.id === editing.id ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/brokers-haste/${deleteTarget.id}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const count = data.filter((r) => r.type === activeType).length;
  const typeLabel = activeType === "broker" ? "Brokers" : "Haste (Delivery Agents)";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">{typeLabel}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{count} record{count !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <ExportButton
            filename={`${activeType}s.csv`}
            headers={activeType === "broker" ? ["Name", "PAN Card", "GST", "Phone", "Address", "Type"] : ["Name", "Type"]}
            keys={activeType === "broker" ? ["name", "panCard", "gst", "phone", "address", "type"] : ["name", "type"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add {activeType === "broker" ? "Broker" : "Haste"}</Button>}
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 rounded-lg p-1 w-fit">
        <Button
          onClick={() => setActiveType("broker")}
          variant={activeType === "broker" ? "secondary" : "ghost"}
          size="sm"
          className="uppercase tracking-wider"
        >
          <User className="h-3.5 w-3.5" />
          Brokers
        </Button>
        <Button
          onClick={() => setActiveType("haste")}
          variant={activeType === "haste" ? "secondary" : "ghost"}
          size="sm"
          className="uppercase tracking-wider"
        >
          <Truck className="h-3.5 w-3.5" />
          Haste (Delivery)
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              {activeType === "broker" && (
                <>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">PAN</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GST</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Address</th>
                </>
              )}
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={activeType === "broker" ? 7 : 3} className="px-4 py-8 text-center text-sm text-muted-foreground">No records found.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                {activeType === "broker" && (
                  <>
                    <td className="px-4 py-3 text-muted-foreground">{row.panCard || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.gst || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.phone || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{row.address || "-"}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <Badge variant={row.type === "broker" ? "default" : "secondary"} className="text-[10px] uppercase">
                    {row.type}
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
            <SheetTitle>{editing ? "Edit" : "New"} {form.type === "broker" ? "Broker" : "Haste"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Enter name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "broker" | "haste" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="haste">Haste (Delivery Agent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "broker" && (
              <>
                <div className="space-y-2">
                  <Label>PAN Card</Label>
                  <Input placeholder="Enter PAN Card" value={form.panCard} onChange={(e) => setForm((f) => ({ ...f, panCard: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>GST</Label>
                  <Input placeholder="Enter GST" value={form.gst} onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input placeholder="Enter Phone Number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input placeholder="Enter Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
              </>
            )}
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
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
