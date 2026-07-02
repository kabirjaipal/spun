"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Building2, Landmark, MapPin, Calendar, FileText, Phone, Mail, DollarSign, Globe, ArrowLeft } from "lucide-react";
import ExportButton from "@/components/ExportButton";
import { BANK_LIST, type BankData } from "@/lib/banks";
import { CURRENCIES, MARKET_CATEGORIES } from "@/lib/constants";

interface Party {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  panNo: string | null;
  pincode: string | null;
  state: string | null;
  currencySymbol: string | null;
  nationName: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branchName: string | null;
  accountType: string | null;
  msmeRegistered: boolean;
  msmeType: string | null;
  msmeNo: string | null;
  gstApplicable: boolean | null;
  gstType: string | null;
  stateCode: string | null;
  city: string | null;
  companyType: string | null;
  marketCategory: string | null;
  financialYearStart: string | null;
  dueDay: number;
  pendingDueDay?: number;
}

const currentYear = new Date().getFullYear();
const defaultFyStart = `${currentYear}-04-01`;

const EMPTY = {
  companyName: "",
  gstNo: "",
  phone: "",
  email: "",
  address: "",
  panNo: "",
  pincode: "",
  state: "",
  currencySymbol: "₹",
  nationName: "India",
  bankName: "",
  bankAccountName: "",
  accountNo: "",
  ifscCode: "",
  branchName: "",
  accountType: "current",
  gstApplicable: false,
  gstType: "regular",
  stateCode: "",
  city: "",
  companyType: "general",
  marketCategory: "Retail",
  financialYearStart: defaultFyStart,
  msmeRegistered: false,
  msmeType: "micro",
  msmeNo: "",
  dueDay: 10,
};

function mergeBanks(base: BankData[], custom: BankData[]): BankData[] {
  const result = [...base.map(b => ({ ...b, branches: [...b.branches] }))];
  for (const cBank of custom) {
    const existing = result.find(b => b.bankName.toLowerCase() === cBank.bankName.toLowerCase());
    if (existing) {
      for (const cBranch of cBank.branches) {
        const branchExists = existing.branches.some(
          br => br.ifscCode.toLowerCase() === cBranch.ifscCode.toLowerCase()
        );
        if (!branchExists) {
          existing.branches.push(cBranch);
        }
      }
    } else {
      result.push(cBank);
    }
  }
  return result;
}

export default function PartiesClient({
  initialData, canCreate, canUpdate, canDelete, canExport,
}: {
  initialData: Party[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedBankIndex, setSelectedBankIndex] = useState<number | null>(null);
  const [customBankActive, setCustomBankActive] = useState(true);
  const [customIfscActive, setCustomIfscActive] = useState(true);

  const [localBanks, setLocalBanks] = useState<BankData[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("texora_custom_banks");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return mergeBanks(BANK_LIST, parsed);
        } catch (e) {
          // ignore
        }
      }
    }
    return BANK_LIST;
  });

  const saveCustomBanks = (updatedBanks: BankData[]) => {
    setLocalBanks(updatedBanks);
    if (typeof window !== "undefined") {
      localStorage.setItem("texora_custom_banks", JSON.stringify(updatedBanks));
    }
  };

  const captureCustomBank = (formState: typeof EMPTY, currentBanks: BankData[]) => {
    if (
      customBankActive &&
      formState.bankName.trim() &&
      formState.branchName.trim() &&
      formState.ifscCode.trim()
    ) {
      const bName = formState.bankName.trim();
      const brName = formState.branchName.trim();
      const ifsc = formState.ifscCode.trim().toUpperCase();

      const updated = [...currentBanks.map(b => ({ ...b, branches: [...b.branches] }))];
      const existingBankIndex = updated.findIndex(
        (b) => b.bankName.toLowerCase() === bName.toLowerCase()
      );

      if (existingBankIndex !== -1) {
        const bank = updated[existingBankIndex];
        const branchExists = bank.branches.some(
          (br) => br.ifscCode.toUpperCase() === ifsc
        );
        if (!branchExists) {
          bank.branches.push({ branchName: brName, ifscCode: ifsc });
          return updated;
        }
      } else {
        updated.push({
          bankName: bName,
          branches: [{ branchName: brName, ifscCode: ifsc }],
        });
        return updated;
      }
    }
    return null;
  };

  useEffect(() => {
    fetch("/api/users/banks")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLocalBanks((prev) => mergeBanks(prev, data));
        }
      })
      .catch((err) => console.error("Failed to load user banks from DB", err));
  }, []);

  const filtered = data.filter((r) =>
    r.companyName.toLowerCase().includes(search.toLowerCase()) ||
    (r.gstNo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.phone ?? "").includes(search)
  );

  function openCreate() {
    setError(null);
    setEditing(null);
    setForm(EMPTY);
    setSelectedBankIndex(null);
    setCustomBankActive(true);
    setCustomIfscActive(true);
    setIsFormOpen(true);
  }

  function openEdit(row: Party) {
    setError(null);
    setEditing(row);
    
    const bankIndex = localBanks.findIndex(b => b.bankName === row.bankName);
    const isPreseededBank = bankIndex !== -1;
    const isPreseededIfsc = isPreseededBank && localBanks[bankIndex].branches.some(br => br.ifscCode === row.ifscCode);

    setForm({
      companyName: row.companyName,
      gstNo: row.gstNo ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      panNo: row.panNo ?? "",
      pincode: row.pincode ?? "",
      state: row.state ?? "",
      currencySymbol: row.currencySymbol ?? "₹",
      nationName: row.nationName ?? "India",
      bankName: row.bankName ?? "",
      bankAccountName: row.bankAccountName ?? "",
      accountNo: row.accountNo ?? "",
      ifscCode: row.ifscCode ?? "",
      branchName: row.branchName ?? "",
      accountType: row.accountType ?? "current",
      gstApplicable: !!row.gstApplicable,
      gstType: row.gstType ?? "regular",
      stateCode: row.stateCode ?? "",
      city: row.city ?? "",
      companyType: row.companyType ?? "general",
      marketCategory: row.marketCategory ?? "Retail",
      financialYearStart: row.financialYearStart ?? defaultFyStart,
      msmeRegistered: !!row.msmeRegistered,
      msmeType: row.msmeType ?? "micro",
      msmeNo: row.msmeNo ?? "",
      dueDay: row.dueDay !== undefined ? row.dueDay : 10,
    });

    setSelectedBankIndex(isPreseededBank ? bankIndex : null);
    setCustomBankActive(!isPreseededBank);
    setCustomIfscActive(!isPreseededIfsc);

    setIsFormOpen(true);
  }

  async function handleSave() {
    if (!form.companyName) return;
    setSaving(true);
    setError(null);
    const url = editing ? `/api/parties/${editing.companyId}` : "/api/parties";
    try {
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gstNo: form.gstApplicable ? form.gstNo : null,
          stateCode: form.gstApplicable ? form.stateCode : null,
          city: form.gstApplicable ? form.city : null,
          gstType: form.gstApplicable ? form.gstType : null,
          msmeType: form.msmeRegistered ? form.msmeType : null,
          msmeNo: form.msmeRegistered ? form.msmeNo : null,
        }),
      });
      const row = await res.json();
      if (!res.ok) {
        throw new Error(row.error || "Failed to save party");
      }
      if (editing) setData((d) => d.map((r) => (r.companyId === editing.companyId ? { ...r, ...row } : r)));
      else setData((d) => [...d, { ...row, pendingDueDay: 0 }]);

      const updatedBanks = captureCustomBank(form, localBanks);
      if (updatedBanks) {
        saveCustomBanks(updatedBanks);
      }

      setIsFormOpen(false);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/parties/${deleteTarget.companyId}`, { method: "DELETE" });
    setData((d) => d.filter((r) => r.companyId !== deleteTarget.companyId));
    setDeleteTarget(null);
  }

  if (isFormOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setIsFormOpen(false)} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to list</span>
          </Button>
          <h1 className="text-xl font-bold text-foreground">
            {editing ? `Edit Party: ${editing.companyName}` : "Create New Party"}
          </h1>
        </div>

        {error && (
          <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger font-medium">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* General Details & Taxation */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>General Details</span>
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <Label htmlFor="companyName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party Name *</Label>
                    <Input
                      id="companyName"
                      type="text"
                      required
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      className="mt-1"
                      placeholder="e.g. Acme Fabrics Pvt Ltd"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="address"
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                        className="pl-10"
                        placeholder="e.g. Ring Road, Surat"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pincode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pincode</Label>
                    <Input
                      id="pincode"
                      type="text"
                      value={form.pincode}
                      onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                      className="mt-1"
                      placeholder="395003"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</Label>
                    <Input
                      id="state"
                      type="text"
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      className="mt-1"
                      placeholder="Gujarat"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="phone"
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        className="pl-10"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className="pl-10"
                        placeholder="info@acmefabrics.com"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="currencySymbol" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency Symbol</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <select
                          id="currencySymbol"
                          value={form.currencySymbol}
                          onChange={(e) => {
                            const val = e.target.value;
                            const match = CURRENCIES.find((c) => c.symbol === val);
                            setForm((f) => ({
                              ...f,
                              currencySymbol: val,
                              nationName: match ? match.nation : f.nationName,
                            }));
                          }}
                          className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CURRENCIES.map((c) => (
                            <option key={c.symbol} value={c.symbol}>
                              {c.label}
                            </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="nationName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nation Name</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <select
                          id="nationName"
                          value={form.nationName}
                          onChange={(e) => {
                            const val = e.target.value;
                            const match = CURRENCIES.find((c) => c.nation === val);
                            setForm((f) => ({
                              ...f,
                              nationName: val,
                              currencySymbol: match ? match.symbol : f.currencySymbol,
                            }));
                          }}
                          className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {CURRENCIES.map((c) => (
                            <option key={c.nation} value={c.nation}>
                              {c.nation}
                            </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="companyType" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Party Type *</Label>
                    <select
                        id="companyType"
                        value={form.companyType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((f) => ({
                            ...f,
                            companyType: val,
                            marketCategory: MARKET_CATEGORIES[val][0],
                          }));
                        }}
                        className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="general">General / Standard</option>
                      <option value="textiles">Textiles</option>
                      <option value="diamond">Diamond</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="marketCategory" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Category *</Label>
                    <select
                        id="marketCategory"
                        value={form.marketCategory}
                        onChange={(e) => setForm((f) => ({ ...f, marketCategory: e.target.value }))}
                        className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {MARKET_CATEGORIES[form.companyType]?.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="financialYearStart" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial Year Start *</Label>
                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="financialYearStart"
                        type="date"
                        required
                        value={form.financialYearStart}
                        onChange={(e) => setForm((f) => ({ ...f, financialYearStart: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dueDay" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Days (Credit Days) *</Label>
                    <Input
                      id="dueDay"
                      type="number"
                      required
                      value={form.dueDay}
                      onChange={(e) => setForm((f) => ({ ...f, dueDay: Number(e.target.value) }))}
                      className="mt-1"
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* MSME Registration */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>MSME Registration</span>
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-normal text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={form.msmeRegistered}
                    onChange={(e) => setForm((f) => ({ ...f, msmeRegistered: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                  />
                  Registered
                </label>
              </div>

              {form.msmeRegistered && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="msmeType" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MSME Category</Label>
                    <select
                      id="msmeType"
                      value={form.msmeType}
                      onChange={(e) => setForm((f) => ({ ...f, msmeType: e.target.value }))}
                      className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="micro">Micro</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="msmeNo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Udyam Registration No.</Label>
                    <Input
                      id="msmeNo"
                      type="text"
                      value={form.msmeNo}
                      onChange={(e) => setForm((f) => ({ ...f, msmeNo: e.target.value.toUpperCase() }))}
                      className="mt-1"
                      placeholder="UDYAM-GJ-01-0012345"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  <span>GST & Taxation</span>
                </h3>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-normal text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={form.gstApplicable}
                    onChange={(e) => setForm((f) => ({ ...f, gstApplicable: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                  />
                  GST Applicable
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="panNo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PAN No.</Label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="panNo"
                      type="text"
                      value={form.panNo}
                      onChange={(e) => setForm((f) => ({ ...f, panNo: e.target.value }))}
                      className="pl-10"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                {form.gstApplicable && (
                  <>
                    <div>
                      <Label htmlFor="gstNo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GSTIN *</Label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                          id="gstNo"
                          type="text"
                          required={form.gstApplicable}
                          value={form.gstNo}
                          onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value }))}
                          className="pl-10"
                          placeholder="24AAAAB1234C1Z1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="stateCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State Code *</Label>
                      <Input
                        id="stateCode"
                        type="text"
                        required={form.gstApplicable}
                        value={form.stateCode}
                        onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                        className="mt-1"
                        placeholder="24"
                      />
                    </div>

                    <div>
                      <Label htmlFor="city" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City *</Label>
                      <Input
                        id="city"
                        type="text"
                        required={form.gstApplicable}
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        className="mt-1"
                        placeholder="Surat"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gstType" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration Type</Label>
                      <select
                        id="gstType"
                        value={form.gstType}
                        onChange={(e) => setForm((f) => ({ ...f, gstType: e.target.value }))}
                        className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="regular">Regular</option>
                        <option value="composition">Composition</option>
                        <option value="export">Export</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details & Save Options */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                <span>Bank Account Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Bank</Label>
                  <select
                    value={customBankActive ? "custom" : selectedBankIndex ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setCustomBankActive(true);
                        setCustomIfscActive(true);
                        setSelectedBankIndex(null);
                        setForm((f) => ({ ...f, bankName: "", ifscCode: "", branchName: "" }));
                      } else {
                        setCustomBankActive(false);
                        setCustomIfscActive(false);
                        const bankIndex = Number(val);
                        const bank = localBanks[bankIndex];
                        setSelectedBankIndex(bankIndex);
                        
                        setForm((f) => ({
                          ...f,
                          bankName: bank.bankName,
                          ifscCode: bank.branches.length > 0 ? bank.branches[0].ifscCode : "",
                          branchName: bank.branches.length > 0 ? bank.branches[0].branchName : "",
                        }));
                      }
                    }}
                    className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="custom">Other / Custom Bank</option>
                    {localBanks.map((b, idx) => (
                      <option key={b.bankName} value={idx}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                {customBankActive ? (
                  <div>
                    <Label htmlFor="bankName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Name</Label>
                    <Input
                      id="bankName"
                      type="text"
                      value={form.bankName}
                      onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                      className="mt-1"
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Name</Label>
                    <span className="text-sm font-semibold text-foreground px-3 h-10 mt-1 flex items-center bg-muted/20 border rounded-md">
                      {form.bankName}
                    </span>
                  </div>
                )}

                <div>
                  <Label htmlFor="bankAccountName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Name</Label>
                  <Input
                    id="bankAccountName"
                    type="text"
                    value={form.bankAccountName}
                    onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                    className="mt-1"
                    placeholder="e.g. Acme Fabrics Pvt Ltd"
                  />
                </div>

                <div>
                  <Label htmlFor="accountNo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Number</Label>
                  <Input
                    id="accountNo"
                    type="text"
                    value={form.accountNo}
                    onChange={(e) => setForm((f) => ({ ...f, accountNo: e.target.value }))}
                    className="mt-1"
                    placeholder="e.g. 123456789012"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Branch / IFSC</Label>
                  {customBankActive ? (
                    <span className="text-sm text-muted-foreground px-3 h-10 mt-1 flex items-center bg-muted/10 border rounded-md select-none">
                      Type custom details below
                    </span>
                  ) : (
                    <select
                      value={customIfscActive ? "custom" : localBanks[selectedBankIndex!].branches.findIndex(b => b.ifscCode === form.ifscCode)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setCustomIfscActive(true);
                          setForm((f) => ({ ...f, ifscCode: "", branchName: "" }));
                        } else {
                          setCustomIfscActive(false);
                          const branchIndex = Number(val);
                          const branch = localBanks[selectedBankIndex!].branches[branchIndex];
                          setForm((f) => ({
                            ...f,
                            ifscCode: branch.ifscCode,
                            branchName: branch.branchName,
                          }));
                        }
                      }}
                      className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {localBanks[selectedBankIndex!].branches.map((b, idx) => (
                        <option key={b.ifscCode} value={idx}>
                          {b.branchName} ({b.ifscCode})
                        </option>
                      ))}
                      <option value="custom">Other / Custom Branch</option>
                    </select>
                  )}
                </div>

                <div>
                  <Label htmlFor="ifscCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IFSC Code</Label>
                  <Input
                    id="ifscCode"
                    type="text"
                    disabled={!customIfscActive}
                    value={form.ifscCode}
                    onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                    className="mt-1"
                    placeholder="e.g. SBIN0001234"
                  />
                </div>

                <div>
                  <Label htmlFor="branchName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Name</Label>
                  <Input
                    id="branchName"
                    type="text"
                    disabled={!customIfscActive}
                    value={form.branchName}
                    onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
                    className="mt-1"
                    placeholder="e.g. Ring Road Branch"
                  />
                </div>

                <div>
                  <Label htmlFor="accountType" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Type</Label>
                  <select
                    id="accountType"
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
                    className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="current">Current Account</option>
                    <option value="cc">CC Account</option>
                    <option value="od">OD Account</option>
                    <option value="saving">Saving Account</option>
                    <option value="other">Other Account</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t justify-end">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.companyName || (form.gstApplicable && (!form.gstNo || !form.stateCode || !form.city))}>
                {saving ? "Saving..." : editing ? "Update Party" : "Create Party"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">Parties</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.length} part{data.length !== 1 ? "ies" : "y"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Input id="search-parties" placeholder="Search name, GST, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
          <ExportButton
            filename="parties.csv"
            headers={["Party Name", "GSTIN", "Phone", "Email", "Address", "Module/Type"]}
            keys={["companyName", "gstNo", "phone", "email", "address", "companyType"]}
            rows={filtered}
            canExport={canExport}
          />
          {canCreate && <Button onClick={openCreate}>+ Add Party</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">GSTIN</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Due Days</th>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Due Days</th>
              {(canUpdate || canDelete) && <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? "No parties match your search." : "No parties yet. Add your first one."}
              </td></tr>
            )}
            {filtered.map((row, i) => (
              <tr key={row.companyId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{row.companyName}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{row.gstNo || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{row.phone || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{row.companyType || "general"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-semibold">{row.dueDay}</td>
                <td className="px-4 py-3 text-xs">
                  {row.pendingDueDay && row.pendingDueDay > 0 ? (
                    <Badge variant="destructive" className="font-mono text-xs font-bold">
                      {row.pendingDueDay} Day{row.pendingDueDay !== 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {(canUpdate || canDelete) && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {canUpdate && <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(row)} className="text-danger hover:text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Delete Party</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <span className="font-semibold text-foreground">{deleteTarget?.companyName}</span>? Their ledger will also be removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
