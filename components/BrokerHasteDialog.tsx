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
  onCreated: (item: {
    id: number;
    name: string;
    type: string;
    panCard?: string | null;
    gst?: string | null;
    address?: string | null;
    phone?: string | null;
  }) => void;
}

export default function BrokerHasteDialog({ type, open, onOpenChange, onCreated }: BrokerHasteDialogProps) {
  const [name, setName] = useState("");
  const [panCard, setPanCard] = useState("");
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = type === "broker" ? "New Broker" : "New Haste (Delivery Agent)";
  const label = type === "broker" ? "Broker Name" : "Haste Name";
  const placeholder = type === "broker" ? "e.g. Vinod Broker" : "e.g. DTDC Courier";

  function clearForm() {
    setName("");
    setPanCard("");
    setGst("");
    setAddress("");
    setPhone("");
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/brokers-haste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          panCard: type === "broker" && panCard.trim() ? panCard.trim() : undefined,
          gst: type === "broker" && gst.trim() ? gst.trim() : undefined,
          address: type === "broker" && address.trim() ? address.trim() : undefined,
          phone: type === "broker" && phone.trim() ? phone.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create");
      }
      const item = await res.json();
      onCreated(item);
      clearForm();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { clearForm(); } onOpenChange(o); }}>
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

          {type === "broker" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-foreground">PAN Card</Label>
                  <Input
                    placeholder="Enter PAN Card"
                    value={panCard}
                    onChange={(e) => setPanCard(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase text-foreground">GST IN</Label>
                  <Input
                    placeholder="Enter GST"
                    value={gst}
                    onChange={(e) => setGst(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">Phone Number</Label>
                <Input
                  placeholder="Enter Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase text-foreground">Address</Label>
                <Input
                  placeholder="Enter Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </>
          )}

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
