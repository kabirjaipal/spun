"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface UnitOfMeasurement {
  unitId: number;
  unitCode: string;
  unitName: string;
  isFixed: boolean;
}

interface Props {
  data: UnitOfMeasurement[];
  setData: React.Dispatch<React.SetStateAction<UnitOfMeasurement[]>>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export default function UnitsOfMeasurementClient({ data, setData, canCreate, canUpdate, canDelete, canExport }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasurement | null>(null);
  const [form, setForm] = useState({ unitCode: "", unitName: "" });
  const [deleteTarget, setDeleteTarget] = useState<UnitOfMeasurement | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = data.filter((r) =>
    r.unitCode.toLowerCase().includes(search.toLowerCase()) ||
    r.unitName.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm({ unitCode: "", unitName: "" });
    setErrorMsg(null);
    setSheetOpen(true);
  }

  function openEdit(row: UnitOfMeasurement) {
    setEditing(row);
    setForm({ unitCode: row.unitCode, unitName: row.unitName });
    setErrorMsg(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.unitCode.trim() || !form.unitName.trim()) return;
    setSaving(true);
    setErrorMsg(null);

    const url = editing ? `/api/units-of-measurement/${editing.unitId}` : "/api/units-of-measurement";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitCode: form.unitCode.trim(), unitName: form.unitName.trim() }),
    });

    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.error || "Failed to save unit");
      setSaving(false);
      return;
    }

    if (editing) setData((d) => d.map((r) => (r.unitId === editing.unitId ? body : r)));
    else setData((d) => [...d, body]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setErrorMsg(null);
    const res = await fetch(`/api/units-of-measurement/${deleteTarget.unitId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      alert(body.error || "Failed to delete unit");
      setDeleteTarget(null);
      return;
    }
    setData((d) => d.filter((r) => r.unitId !== deleteTarget.unitId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Units of Measurement</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} unit{data.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder="Search unit..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
          <ExportButton
            filename="units_of_measurement.csv"
            headers={["Unit Code", "Unit Name", "System Fixed"]}
            keys={["unitCode", "unitName", "isFixed"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Unit</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit Code</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Fixed Default</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No units found.</td></tr>
            )}
            {filtered.map((row) => (
              <tr key={row.unitId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-foreground">{row.unitCode}</td>
                <td className="px-4 py-3 text-foreground">{row.unitName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.isFixed ? "Yes" : "No"}</td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {canUpdate && (
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && !row.isFixed && (
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
            <SheetTitle>{editing ? "Edit Unit" : "New Unit"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-5">
            {errorMsg && <p className="text-sm font-semibold text-danger">{errorMsg}</p>}
            <div className="space-y-2">
              <Label>Unit Code</Label>
              <Input id="unitCode" placeholder="e.g. PCS, MTR, KGS" value={form.unitCode} onChange={(e) => setForm((f) => ({ ...f, unitCode: e.target.value }))} disabled={editing?.isFixed} />
            </div>
            <div className="space-y-2">
              <Label>Unit Name</Label>
              <Input id="unitName" placeholder="e.g. Pieces, Meters, Kilograms" value={form.unitName} onChange={(e) => setForm((f) => ({ ...f, unitName: e.target.value }))} />
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.unitCode.trim() || !form.unitName.trim()}>
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
            <DialogTitle className="text-sm font-bold uppercase text-danger">Delete Unit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.unitCode} - {deleteTarget?.unitName}</span>?
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
