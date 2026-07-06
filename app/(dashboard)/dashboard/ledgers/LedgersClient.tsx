"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, FolderTree } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import Link from "next/link";

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  referenceId: number | null;
  shortName: string | null;
  address: string | null;
  groupId: number | null;
  gstNo: string | null;
  msmeType: string | null;
  panNo: string | null;
  isTdsApplicable: boolean;
  tdsRate: string;
  creditDays: number;
  rateOfInterest: string;
}

interface LedgerGroup {
  groupId: number;
  groupName: string;
}

const LEDGER_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "customer", label: "Customer" },
  { value: "company", label: "Company" },
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
  { value: "tax", label: "Tax" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "capital", label: "Capital" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
];

const MSME_TYPES = [
  { value: "non_registered", label: "Non Registered" },
  { value: "micro", label: "Registered - Micro" },
  { value: "small", label: "Registered - Small" },
  { value: "medium", label: "Registered - Medium" },
];

const TYPE_COLOR: Record<string, string> = {
  cash: "bg-success/10 text-success",
  bank: "bg-info/10 text-info",
  customer: "bg-primary/10 text-primary",
  company: "bg-warning/10 text-warning",
  sales: "bg-success/10 text-success",
  purchase: "bg-danger/10 text-danger",
  expense: "bg-danger/10 text-danger",
  income: "bg-success/10 text-success",
};

const EMPTY = {
  ledgerName: "",
  ledgerType: "other",
  shortName: "",
  address: "",
  groupId: "",
  gstNo: "",
  msmeType: "non_registered",
  panNo: "",
  isTdsApplicable: false,
  tdsRate: "0.00",
  creditDays: 0,
  rateOfInterest: "0.00",
  newGroupName: "", // for inline creation
};

export default function LedgersClient({
  initialData,
  groups,
  canCreate,
  canUpdate,
  canDelete,
  canExport,
}: {
  initialData: Ledger[];
  groups: LedgerGroup[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [groupList, setGroupList] = useState(groups);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Ledger | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Ledger | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  const filtered = data.filter((r) =>
    r.ledgerName.toLowerCase().includes(search.toLowerCase()) ||
    r.ledgerType.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setShowNewGroupInput(false);
    setSheetOpen(true);
  }

  function openEdit(row: Ledger) {
    setEditing(row);
    setForm({
      ledgerName: row.ledgerName,
      ledgerType: row.ledgerType,
      shortName: row.shortName || "",
      address: row.address || "",
      groupId: row.groupId ? String(row.groupId) : "",
      gstNo: row.gstNo || "",
      msmeType: row.msmeType || "non_registered",
      panNo: row.panNo || "",
      isTdsApplicable: row.isTdsApplicable,
      tdsRate: row.tdsRate,
      creditDays: row.creditDays,
      rateOfInterest: row.rateOfInterest,
      newGroupName: "",
    });
    setShowNewGroupInput(false);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.ledgerName || !form.ledgerType) return;
    setSaving(true);

    try {
      let selectedGroupId = form.groupId;

      // Handle new group creation inline
      if (showNewGroupInput && form.newGroupName) {
        const groupRes = await fetch("/api/ledger-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupName: form.newGroupName }),
        });
        if (groupRes.ok) {
          const newGroup = await groupRes.json();
          setGroupList((prev) => [...prev, newGroup].sort((a, b) => a.groupName.localeCompare(b.groupName)));
          selectedGroupId = String(newGroup.groupId);
        }
      }

      const url = editing ? `/api/ledgers/${editing.ledgerId}` : "/api/ledgers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          groupId: selectedGroupId ? Number(selectedGroupId) : null,
        }),
      });

      const row = await res.json();
      if (editing) {
        setData((d) => d.map((r) => (r.ledgerId === editing.ledgerId ? row : r)));
      } else {
        setData((d) => [...d, row]);
      }
      setSheetOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/ledgers/${deleteTarget.ledgerId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.ledgerId !== deleteTarget.ledgerId));
    setDeleteTarget(null);
  }

  const isManual = (row: Ledger) => !row.referenceId;
  const getGroupName = (groupId: number | null) => {
    if (!groupId) return "—";
    return groupList.find((g) => g.groupId === groupId)?.groupName || "—";
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Ledgers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} ledger{data.length !== 1 ? "s" : ""} — Chart of Accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-ledgers" placeholder="Search name or type..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
          <ExportButton
            filename="ledgers.csv"
            headers={["Ledger Name", "Short Name", "Type", "Group", "Source", "GST No", "PAN No"]}
            keys={["ledgerName", "shortName", "ledgerType", "groupName", "source", "gstNo", "panNo"]}
            rows={filtered.map(r => ({
              ...r,
              groupName: getGroupName(r.groupId),
              source: isManual(r) ? "Manual" : "Auto",
            }))}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Ledger</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Ledger Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Short Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Group</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Source</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">{search ? "No ledgers match." : "No ledgers yet."}</td></tr>
            )}
            {filtered.map((row, i) => {
              const badgeClass = TYPE_COLOR[row.ledgerType] || "bg-muted text-muted-foreground";
              return (
                <tr key={row.ledgerId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.ledgerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.shortName || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase ${badgeClass}`}>{row.ledgerType}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{getGroupName(row.groupId)}</td>
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
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Ledger" : "New Ledger"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Ledger Name *</Label>
                <Input id="ledgerName" placeholder="e.g. HDFC Bank Current A/c" value={form.ledgerName} onChange={(e) => setForm((f) => ({ ...f, ledgerName: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Short Name</Label>
                <Input id="shortName" placeholder="e.g. HDFC" value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Ledger Type *</Label>
                <Select value={form.ledgerType} onValueChange={(v) => setForm((f) => ({ ...f, ledgerType: v }))}>
                  <SelectTrigger id="ledgerType"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {LEDGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Group</Label>
                {showNewGroupInput ? (
                  <div className="flex gap-2">
                    <Input placeholder="Enter new group name" value={form.newGroupName} onChange={(e) => setForm((f) => ({ ...f, newGroupName: e.target.value }))} />
                    <Button type="button" variant="outline" onClick={() => setShowNewGroupInput(false)}>Select Group</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={form.groupId} onValueChange={(v) => setForm((f) => ({ ...f, groupId: v }))}>
                      <SelectTrigger id="ledgerGroup"><SelectValue placeholder="Select group" /></SelectTrigger>
                      <SelectContent>
                        {groupList.map((g) => <SelectItem key={g.groupId} value={String(g.groupId)}>{g.groupName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => setShowNewGroupInput(true)}>+ New Group</Button>
                  </div>
                )}
              </div>

              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Address</Label>
                <Input id="address" placeholder="e.g. Ring Road, Surat" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>GST No.</Label>
                <Input id="gstNo" placeholder="24AAAAB1234C1Z1" value={form.gstNo} onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value.toUpperCase() }))} />
              </div>

              <div className="space-y-2">
                <Label>PAN No.</Label>
                <Input id="panNo" placeholder="ABCDE1234F" value={form.panNo} onChange={(e) => setForm((f) => ({ ...f, panNo: e.target.value.toUpperCase() }))} />
              </div>

              <div className="space-y-2">
                <Label>MSME Registration Type</Label>
                <Select value={form.msmeType} onValueChange={(v) => setForm((f) => ({ ...f, msmeType: v }))}>
                  <SelectTrigger id="msmeType"><SelectValue placeholder="Select MSME status" /></SelectTrigger>
                  <SelectContent>
                    {MSME_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Credit Days</Label>
                <Input type="number" id="creditDays" value={form.creditDays} onChange={(e) => setForm((f) => ({ ...f, creditDays: Number(e.target.value) }))} />
              </div>

              <div className="space-y-2">
                <Label>Rate of Interest (%)</Label>
                <Input type="text" id="rateOfInterest" value={form.rateOfInterest} onChange={(e) => setForm((f) => ({ ...f, rateOfInterest: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>TDS Details</Label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-normal text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={form.isTdsApplicable}
                      onChange={(e) => setForm((f) => ({ ...f, isTdsApplicable: e.target.checked }))}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                    />
                    TDS Applicable
                  </label>
                  {form.isTdsApplicable && (
                    <Input type="text" placeholder="TDS Rate %" className="w-24 h-9" value={form.tdsRate} onChange={(e) => setForm((f) => ({ ...f, tdsRate: e.target.value }))} />
                  )}
                </div>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.ledgerName || !form.ledgerType}>
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
