"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface MillFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (millParty: any) => void;
}

const EMPTY = {
  millName: "",
  gstNo: "",
  address: "",
  gstType: "unregistered",
  city: "",
  stateCode: "",
  phone: "",
  msmeRegistered: false,
  msmeType: "non_registered",
};

export default function MillFormDrawer({ isOpen, onClose, onCreated }: MillFormDrawerProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY);
      setError(null);
      setShowAllDetails(false);
    }
  }, [isOpen]);

  async function handleSave() {
    if (!form.millName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          millName: form.millName.trim(),
          gstNo: form.gstNo ? form.gstNo.trim().toUpperCase() : null,
        }),
      });
      const row = await res.json();
      if (!res.ok) {
        throw new Error(row.error || "Failed to save mill party");
      }
      onCreated(row);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-[500px] w-full flex flex-col h-full p-0">
        <SheetHeader className="px-5 py-4 border-b border-border bg-muted/30">
          <SheetTitle className="text-sm font-bold uppercase tracking-wider text-foreground">Create New Mill Party</SheetTitle>
        </SheetHeader>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-danger bg-danger/10 p-3 text-xs text-danger font-medium">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* BASIC FIELDS */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="millName" className="text-[10px] font-bold uppercase text-muted-foreground">Mill Party Name *</Label>
              <Input
                id="millName"
                type="text"
                required
                value={form.millName}
                onChange={(e) => setForm((f) => ({ ...f, millName: e.target.value }))}
                className="h-9 mt-1"
                placeholder="e.g. Balaji Mill Works"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="stateCode" className="text-[10px] font-bold uppercase text-muted-foreground">State Code (for GST calculations) *</Label>
                <Input
                  id="stateCode"
                  type="text"
                  required
                  value={form.stateCode}
                  onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                  className="h-9 mt-1"
                  placeholder="e.g. 24"
                />
              </div>

              <div>
                <Label htmlFor="city" className="text-[10px] font-bold uppercase text-muted-foreground">City</Label>
                <Input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="h-9 mt-1"
                  placeholder="e.g. Surat"
                />
              </div>
            </div>
          </div>

          {/* GST DETAILS */}
          <div className="space-y-3 pt-3 border-t">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GST Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gstNo" className="text-[10px] font-bold uppercase text-muted-foreground">GSTIN</Label>
                <Input
                  id="gstNo"
                  type="text"
                  value={form.gstNo}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    const sc = val.slice(0, 2);
                    setForm((f) => ({
                      ...f,
                      gstNo: val,
                      stateCode: /^\d{2}$/.test(sc) ? sc : f.stateCode,
                      gstType: val.length > 0 ? "regular" : f.gstType,
                    }));
                  }}
                  className="h-9 mt-1"
                  placeholder="e.g. 24AAAAA1111A1Z1"
                />
              </div>

              <div>
                <Label htmlFor="gstType" className="text-[10px] font-bold uppercase text-muted-foreground">GST Type</Label>
                <select
                  id="gstType"
                  value={form.gstType}
                  onChange={(e) => setForm((f) => ({ ...f, gstType: e.target.value }))}
                  className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="unregistered">Unregistered</option>
                  <option value="regular">Regular</option>
                  <option value="composition">Composition</option>
                </select>
              </div>
            </div>
          </div>

          {/* TOGGLE FOR OPTIONAL DETAILS */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAllDetails(!showAllDetails)}
              className="w-full text-xs font-semibold uppercase tracking-wider h-8"
            >
              {showAllDetails ? "Hide More Details" : "Show More Details (Address, MSME...)"}
            </Button>
          </div>

          {/* OPTIONAL DETAILS */}
          {showAllDetails && (
            <div className="space-y-5 pt-3 border-t">
              <div>
                <Label htmlFor="address" className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                <Input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="h-9 mt-1"
                  placeholder="e.g. 123 Textile Market"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-[10px] font-bold uppercase text-muted-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="h-9 mt-1"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">MSME Registration</h4>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={form.msmeRegistered}
                      onChange={(e) => setForm((f) => ({ ...f, msmeRegistered: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary bg-background"
                    />
                    Registered
                  </label>
                </div>

                {form.msmeRegistered && (
                  <div>
                    <Label htmlFor="msmeType" className="text-[10px] font-bold uppercase text-muted-foreground">MSME Type</Label>
                    <select
                      id="msmeType"
                      value={form.msmeType}
                      onChange={(e) => setForm((f) => ({ ...f, msmeType: e.target.value }))}
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="micro">Micro</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t bg-muted/10 justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.millName.trim() || !form.stateCode.trim()} size="sm">
            {saving ? "Saving..." : "Create Mill Party"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
