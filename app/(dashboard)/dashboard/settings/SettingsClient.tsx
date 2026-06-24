"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CompanyDetails {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  panNo: string | null;
  address: string | null;
  financialYearStart: string | null;
}

interface MasterCounts {
  customers: number;
  suppliers: number;
  products: number;
  ledgers: number;
  taxRates: number;
}

export default function SettingsClient({
  company,
  counts,
}: {
  company: CompanyDetails;
  counts: MasterCounts;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(company.companyName);
  const [gstNo, setGstNo] = useState(company.gstNo || "");
  const [panNo, setPanNo] = useState(company.panNo || "");
  const [address, setAddress] = useState(company.address || "");
  const [financialYearStart, setFinancialYearStart] = useState(company.financialYearStart || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName) {
      setMessage("Company Name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          gstNo,
          panNo,
          address,
          financialYearStart,
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to update settings.");
      }

      setMessage("Company settings updated successfully!");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="text-sm text-muted-foreground">
          View your company profile, financial year, and active master counts.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Settings */}
        <form onSubmit={handleSave} className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company Profile</h2>
          
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GSTIN</Label>
            <Input value={gstNo} onChange={(e) => setGstNo(e.target.value)} placeholder="24AAAAA0000A1Z5" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PAN</Label>
            <Input value={panNo} onChange={(e) => setPanNo(e.target.value)} placeholder="ABCDE1234F" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial Year Start</Label>
            <Input type="date" value={financialYearStart} onChange={(e) => setFinancialYearStart(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Company Head Office" />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Master counts status */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Master Data Status</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Customers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{counts.customers}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Suppliers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{counts.suppliers}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{counts.products}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ledgers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{counts.ledgers}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tax Rates</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{counts.taxRates}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
