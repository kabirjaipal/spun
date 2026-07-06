"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import ExportButton from "@/components/ExportButton";

interface TaxRate {
  taxRateId: number;
  taxName: string;
  taxPercent: string;
}

interface Props {
  initialData: TaxRate[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export default function TaxRatesClient({ initialData, canCreate, canUpdate, canDelete, canExport }: Props) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [form, setForm] = useState({ taxName: "", taxPercent: "" });
  const [deleteTarget, setDeleteTarget] = useState<TaxRate | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ taxName: "", taxPercent: "" });
    setSheetOpen(true);
  }

  function openEdit(row: TaxRate) {
    setEditing(row);
    setForm({ taxName: row.taxName, taxPercent: row.taxPercent });
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const url = editing ? `/api/tax-rates/${editing.taxRateId}` : "/api/tax-rates";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxName: form.taxName, taxPercent: Number(form.taxPercent) }),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.taxRateId === editing.taxRateId ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/tax-rates/${deleteTarget.taxRateId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.taxRateId !== deleteTarget.taxRateId));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Tax Rates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} rate{data.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename="tax_rates.csv"
            headers={["Tax Name", "Rate (%)"]}
            keys={["taxName", "taxPercent"]}
            rows={data}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Tax Rate</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Tax Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Rate (%)</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No tax rates found. Add your first one.</td></tr>
            )}
            {data.map((row, i) => (
              <tr key={row.taxRateId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.taxName}</td>
                <td className="px-4 py-3 text-foreground">{Number(row.taxPercent).toFixed(2)}%</td>
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

      {/* Sheet — Bootstrap offcanvas style */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Tax Rate" : "New Tax Rate"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label>Tax Name</Label>
              <Input id="taxName" placeholder="e.g. GST 18%" value={form.taxName} onChange={(e) => setForm((f) => ({ ...f, taxName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input id="taxPercent" type="number" min={0} max={100} step={0.01} placeholder="e.g. 18" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} />
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.taxName || !form.taxPercent}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Delete Tax Rate</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.taxName}</span>? This action cannot be undone.
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
