"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";

interface TransferItem {
  voucherId: number;
  voucherNo: string;
  voucherDate: Date | null;
  lotNo: string | null;
  partyId: number | null;
  remarks: string | null;
}

interface PartyOption {
  id: number;
  name: string;
  type: string;
}

export default function LotTransferClient({
  lotNumbers,
  targetParties,
  initialTransfers,
  canCreate,
}: {
  lotNumbers: string[];
  targetParties: PartyOption[];
  initialTransfers: TransferItem[];
  canCreate: boolean;
}) {
  const [transfers, setTransfers] = useState<TransferItem[]>(initialTransfers);
  const [isCreating, setIsCreating] = useState(false);
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedLot, setSelectedLot] = useState("");
  const [customLot, setCustomLot] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!canCreate) return;
    const lotNo = selectedLot === "custom" ? customLot : selectedLot;
    if (!voucherNo || !lotNo || !selectedParty) {
      setMessage("Please fill in all fields (Voucher No, Lot Number, and Target Party).");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const body = {
        voucherType: "lot_transfer",
        voucherNo,
        voucherDate,
        partyId: Number(selectedParty),
        lotNo,
        remarks,
      };

      const response = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to record lot transfer.");
      }

      const newVoucher = await response.json();

      const added: TransferItem = {
        voucherId: newVoucher.voucherId,
        voucherNo: newVoucher.voucherNo,
        voucherDate: new Date(newVoucher.voucherDate),
        lotNo: newVoucher.lotNo,
        partyId: newVoucher.partyId,
        remarks: newVoucher.remarks,
      };

      setTransfers([added, ...transfers]);
      setMessage("Lot transfer recorded successfully.");
      setIsCreating(false);

      // Reset
      setVoucherNo("");
      setSelectedLot("");
      setCustomLot("");
      setSelectedParty("");
      setRemarks("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error saving lot transfer.");
    } finally {
      setSaving(false);
    }
  }

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Record Lot Transfer</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Transfer inventory lot to a different job worker, mill, or supplier.</p>
            </div>
          </div>
          <Badge variant="secondary">Lot Transfer</Badge>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transfer / Ref No</Label>
              <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="TR-001" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lot Number</Label>
              <Select value={selectedLot} onValueChange={setSelectedLot}>
                <SelectTrigger><SelectValue placeholder="Select Lot Number" /></SelectTrigger>
                <SelectContent>
                  {lotNumbers.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                  <SelectItem value="custom">[Create / Input New Lot]</SelectItem>
                </SelectContent>
              </Select>
              {selectedLot === "custom" && (
                <Input
                  className="mt-2"
                  value={customLot}
                  onChange={(e) => setCustomLot(e.target.value)}
                  placeholder="Enter custom lot number"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transfer To Party</Label>
              <Select value={selectedParty} onValueChange={setSelectedParty}>
                <SelectTrigger><SelectValue placeholder="Choose Target Party" /></SelectTrigger>
                <SelectContent>
                  {targetParties.map((p) => (
                    <SelectItem key={`${p.type}-${p.id}`} value={String(p.id)}>
                      {p.name} ({p.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Lot transfer for folding / processing" />
          </div>
        </div>

        {message && <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">{message}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !canCreate}>
            {saving ? "Saving..." : "Record Transfer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lot Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Track lot transfers between job workers, mills, and suppliers.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Record Lot Transfer
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Transfer No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Lot Number</th>
              <th className="px-4 py-3">Transferred To</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No lot transfers recorded yet.
                </td>
              </tr>
            ) : (
              transfers.map((t) => {
                const party = targetParties.find((p) => p.id === t.partyId);
                return (
                  <tr key={t.voucherId} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{t.voucherNo}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.voucherDate ? new Date(t.voucherDate).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground font-semibold">{t.lotNo || "—"}</td>
                    <td className="px-4 py-3 text-foreground">
                      {party ? `${party.name} (${party.type})` : `Party ID ${t.partyId}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate">{t.remarks || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
