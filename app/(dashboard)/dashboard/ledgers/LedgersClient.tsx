"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  referenceId: bigint | null;
}

const LEDGER_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
  { value: "tax", label: "Tax" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "capital", label: "Capital" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

const TYPE_COLOR: Record<string, string> = {
  cash: "bg-success/10 text-success",
  bank: "bg-info/10 text-info",
  customer: "bg-primary/10 text-primary",
  supplier: "bg-warning/10 text-warning",
  sales: "bg-success/10 text-success",
  purchase: "bg-danger/10 text-danger",
  expense: "bg-danger/10 text-danger",
  income: "bg-success/10 text-success",
};

const EMPTY = { ledgerName: "", ledgerType: "" };

export default function LedgersClient({
  initialData, canCreate, canUpdate, canDelete,
}: {
  initialData: Ledger[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Ledger | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Ledger | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter((r) =>
    r.ledgerName.toLowerCase().includes(search.toLowerCase()) ||
    r.ledgerType.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setSheetOpen(true); }
  function openEdit(row: Ledger) {
    setEditing(row);
    setForm({ ledgerName: row.ledgerName, ledgerType: row.ledgerType });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.ledgerName || !form.ledgerType) return;
    setSaving(true);
    const url = editing ? `/api/ledgers/${editing.ledgerId}` : "/api/ledgers";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const row = await res.json();
    if (editing) setData((d) => d.map((r) => (r.ledgerId === editing.ledgerId ? row : r)));
    else setData((d) => [...d, row]);
    setSheetOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/ledgers/${deleteTarget.ledgerId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.ledgerId !== deleteTarget.ledgerId));
    setDeleteTarget(null);
  }

  const isManual = (row: Ledger) => !row.referenceId;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Ledgers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} ledger{data.length !== 1 ? "s" : ""} — Chart of Accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-ledgers" placeholder="Search name or type..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-52 text-xs" />
          {canCreate && <Button onClick={openCreate} size="sm">+ Add Ledger</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ledger Name</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{search ? "No ledgers match." : "No ledgers yet."}</td></tr>
            )}
            {filtered.map((row, i) => {
              const badgeClass = TYPE_COLOR[row.ledgerType] || "bg-muted text-muted-foreground";
              return (
                <tr key={row.ledgerId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.ledgerName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}>{row.ledgerType}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{isManual(row) ? "Manual" : "Auto"}</td>
                  {(canUpdate || canDelete) && (
                    <td className="px-4 py-3 text-right space-x-2">
                      {canUpdate && isManual(row) && <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canDelete && isManual(row) && <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(row)} className="text-danger hover:text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Ledger" : "New Ledger"}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ledger Name</Label>
              <Input id="ledgerName" placeholder="e.g. HDFC Bank Current A/c" value={form.ledgerName} onChange={(e) => setForm((f) => ({ ...f, ledgerName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ledger Type</Label>
              <Select value={form.ledgerType} onValueChange={(v) => setForm((f) => ({ ...f, ledgerType: v }))}>
                <SelectTrigger id="ledgerType"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {LEDGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.ledgerName || !form.ledgerType}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Ledger</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.ledgerName}</span>?</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
