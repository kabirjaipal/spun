"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface BrokerHasteDialogProps {
  type: "broker" | "haste";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: { id: number; name: string; type: string }) => void;
}

export default function BrokerHasteDialog({ type, open, onOpenChange, onCreated }: BrokerHasteDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = type === "broker" ? "New Broker" : "New Haste (Delivery Agent)";
  const label = type === "broker" ? "Broker Name" : "Haste Name";
  const placeholder = type === "broker" ? "e.g. Vinod Broker" : "e.g. DTDC Courier";

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brokers-haste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create");
      }
      const item = await res.json();
      onCreated(item);
      setName("");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setName(""); setError(null); } onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-foreground">{label}</Label>
            <Input
              placeholder={placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleCreate(); }}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
