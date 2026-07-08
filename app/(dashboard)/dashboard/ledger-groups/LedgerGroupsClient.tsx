"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, ArrowLeft } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import Link from "next/link";

interface LedgerGroup {
  groupId: number;
  groupName: string;
  parentGroupId: number | null;
  isSystem: boolean;
}

const EMPTY = {
  groupName: "",
  parentGroupId: "",
};

export default function LedgerGroupsClient({
  initialData,
  canCreate,
  canUpdate,
  canDelete,
  canExport,
}: {
  initialData: LedgerGroup[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerGroup | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<LedgerGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const hierarchicalList = useMemo(() => {
    const list: Array<LedgerGroup & { depth: number }> = [];
    const getNodes = (parentId: number | null, depth: number) => {
      data.filter((g) => g.parentGroupId === parentId)
          .sort((a, b) => a.groupName.localeCompare(b.groupName))
          .forEach((g) => {
            list.push({ ...g, depth });
            getNodes(g.groupId, depth + 1);
          });
    };
    getNodes(null, 0);

    if (list.length < data.length) {
      const added = new Set(list.map((l) => l.groupId));
      data.filter((g) => !added.has(g.groupId))
          .sort((a, b) => a.groupName.localeCompare(b.groupName))
          .forEach((g) => {
            list.push({ ...g, depth: 0 });
            getNodes(g.groupId, 1);
          });
    }
    return list;
  }, [data]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return hierarchicalList;
    return hierarchicalList.filter((g) => g.groupName.toLowerCase().includes(term));
  }, [hierarchicalList, search]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setSheetOpen(true);
  }

  function openEdit(row: LedgerGroup) {
    setEditing(row);
    setForm({
      groupName: row.groupName,
      parentGroupId: row.parentGroupId ? String(row.parentGroupId) : "",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.groupName) return;
    setSaving(true);

    try {
      const url = editing ? `/api/ledger-groups/${editing.groupId}` : "/api/ledger-groups";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: form.groupName,
          parentGroupId: form.parentGroupId ? Number(form.parentGroupId) : null,
        }),
      });

      if (res.ok) {
        const row = await res.json();
        if (editing) {
          setData((d) => d.map((r) => (r.groupId === editing.groupId ? row : r)));
        } else {
          setData((d) => [...d, row].sort((a, b) => a.groupName.localeCompare(b.groupName)));
        }
        setSheetOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/ledger-groups/${deleteTarget.groupId}`, { method: "DELETE" });
    if (res.ok) {
      setData((d) => d.filter((r) => r.groupId !== deleteTarget.groupId));
      setDeleteTarget(null);
    }
  }

  const getGroupName = (groupId: number | null) => {
    if (!groupId) return "—";
    return data.find((g) => g.groupId === groupId)?.groupName || "—";
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Ledger Groups</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.length} group{data.length !== 1 ? "s" : ""} — Chart of Accounts Structure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            id="search-groups"
            placeholder="Search group name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52"
          />
          <ExportButton
            filename="ledger_groups.csv"
            headers={["Group Name", "Parent Group", "System Default"]}
            keys={["groupName", "parentGroupName", "isSystemDefault"]}
            rows={filtered.map((r) => ({
              ...r,
              parentGroupName: getGroupName(r.parentGroupId),
              isSystemDefault: r.isSystem ? "Yes" : "No",
            }))}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Group</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Parent Group</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              {(canUpdate || canDelete) && (
                <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? "No groups match." : "No groups yet."}
                </td>
              </tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.groupId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="py-3 font-medium text-foreground" style={{ paddingLeft: `${row.depth * 20 + 16}px` }}>
                  <div className="flex items-center gap-1.5">
                    {row.depth > 0 && (
                      <span className="text-muted-foreground/35 font-normal select-none">↳</span>
                    )}
                    {row.groupName}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{getGroupName(row.parentGroupId)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {row.isSystem ? (
                    <span className="inline-flex items-center rounded bg-secondary text-secondary-foreground px-2 py-0.5 font-semibold uppercase">
                      System
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded bg-primary/10 text-primary px-2 py-0.5 font-semibold uppercase">
                      Custom
                    </span>
                  )}
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {canUpdate && !row.isSystem && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && !row.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(row)}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
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
            <SheetTitle>{editing ? "Edit Ledger Group" : "New Ledger Group"}</SheetTitle>
          </SheetHeader>

          <SheetBody className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name *</Label>
                <Input
                  id="groupName"
                  placeholder="e.g. Manufacturing Overheads"
                  value={form.groupName}
                  onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Parent Group</Label>
                <Select
                  value={form.parentGroupId}
                  onValueChange={(v) => setForm((f) => ({ ...f, parentGroupId: v }))}
                >
                  <SelectTrigger id="parentGroupId">
                    <SelectValue placeholder="Select parent group (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {data
                      .filter((g) => !editing || g.groupId !== editing.groupId) // prevent selecting self as parent
                      .map((g) => (
                        <SelectItem key={g.groupId} value={String(g.groupId)}>
                          {g.groupName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" size="lg" className="px-4" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button size="lg" className="px-4" onClick={handleSave} disabled={saving || !form.groupName}>
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
            <DialogTitle className="text-sm font-bold uppercase">Delete Ledger Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.groupName}</span>?
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
