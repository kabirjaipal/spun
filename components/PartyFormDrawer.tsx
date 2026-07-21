"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Landmark, MapPin, Calendar, FileText, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANK_LIST, type BankData } from "@/lib/banks";
import { CURRENCIES, MARKET_CATEGORIES, STORAGE_BANKS_KEY } from "@/lib/constants";

interface PartyFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (party: any) => void;
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
  groupId: "",
  newGroupName: "",
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

export default function PartyFormDrawer({ isOpen, onClose, onCreated }: PartyFormDrawerProps) {
  const [form, setForm] = useState(EMPTY);
  const [groupList, setGroupList] = useState<{ groupId: number; groupName: string }[]>([]);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);

  const [selectedBankIndex, setSelectedBankIndex] = useState<number | null>(null);
  const [customBankActive, setCustomBankActive] = useState(true);
  const [customIfscActive, setCustomIfscActive] = useState(true);

  const [localBanks, setLocalBanks] = useState<BankData[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_BANKS_KEY);
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
      localStorage.setItem(STORAGE_BANKS_KEY, JSON.stringify(updatedBanks));
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
    if (isOpen) {
      setForm(EMPTY);
      setError(null);
      setSelectedBankIndex(null);
      setCustomBankActive(true);
      setCustomIfscActive(true);
      setShowAllDetails(false);
      setShowNewGroupInput(false);

      // Fetch ledger groups
      fetch("/api/ledger-groups")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setGroupList(data);
          }
        })
        .catch((err) => console.error("Failed to load ledger groups", err));
    }
  }, [isOpen]);

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

  async function handleSave() {
    if (!form.companyName) return;
    setSaving(true);
    setError(null);
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

      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          groupId: selectedGroupId ? Number(selectedGroupId) : null,
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

      const updatedBanks = captureCustomBank(form, localBanks);
      if (updatedBanks) {
        saveCustomBanks(updatedBanks);
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
      <SheetContent className="sm:data-[side=right]:w-[600px] sm:data-[side=right]:max-w-none w-full">
        <SheetHeader>
          <SheetTitle>Create New Party</SheetTitle>
        </SheetHeader>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-danger bg-danger/10 p-3 text-xs text-danger font-medium">
            {error}
          </div>
        )}

        <SheetBody className="space-y-5">
          {/* REQUIRED / BASIC FIELDS */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="companyName" className="text-[10px] font-bold uppercase text-muted-foreground">Party Name *</Label>
              <Input
                id="companyName"
                type="text"
                required
                value={form.companyName}
                onChange={(e) => {
                  const newName = e.target.value;
                  setForm((f) => ({ ...f, companyName: newName, bankAccountName: newName }));
                }}
                className="h-9 mt-1"
                placeholder="e.g. Acme Fabrics Pvt Ltd"
              />
            </div>

            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Group</Label>
              {showNewGroupInput ? (
                <div className="flex gap-2 mt-1">
                  <Input placeholder="Enter new group name" value={form.newGroupName} onChange={(e) => setForm((f) => ({ ...f, newGroupName: e.target.value }))} className="h-9" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewGroupInput(false)} className="h-9">Select Group</Button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Select value={form.groupId} onValueChange={(v) => setForm((f) => ({ ...f, groupId: v }))}>
                    <SelectTrigger id="partyGroup" className="h-9"><SelectValue placeholder="Select group" /></SelectTrigger>
                    <SelectContent>
                      {groupList.map((g) => <SelectItem key={g.groupId} value={String(g.groupId)}>{g.groupName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewGroupInput(true)} className="h-9">+ New Group</Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="state" className="text-[10px] font-bold uppercase text-muted-foreground">State (for GST type) *</Label>
                <Input
                  id="state"
                  type="text"
                  required
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="h-9 mt-1"
                  placeholder="e.g. Gujarat"
                />
              </div>

              <div>
                <Label htmlFor="dueDay" className="text-[10px] font-bold uppercase text-muted-foreground">Due Days *</Label>
                <Input
                  id="dueDay"
                  type="number"
                  required
                  value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: Number(e.target.value) }))}
                  className="h-9 mt-1"
                  placeholder="10"
                />
              </div>
            </div>
          </div>

          {/* GST DETAILS (Required if applicable, optional otherwise) */}
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GST Details</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={form.gstApplicable}
                  onChange={(e) => setForm((f) => ({ ...f, gstApplicable: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary bg-background"
                />
                GST Applicable
              </label>
            </div>

            {form.gstApplicable && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gstNo" className="text-[10px] font-bold uppercase text-muted-foreground">GSTIN *</Label>
                    <Input
                      id="gstNo"
                      type="text"
                      required
                      value={form.gstNo}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        const sc = val.slice(0, 2);
                        setForm((f) => ({
                          ...f,
                          gstNo: val,
                          stateCode: /^\d{2}$/.test(sc) ? sc : f.stateCode,
                        }));
                      }}
                      className="h-9 mt-1"
                      placeholder="24AAAAB1234C1Z1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stateCode" className="text-[10px] font-bold uppercase text-muted-foreground">State Code *</Label>
                    <Input
                      id="stateCode"
                      type="text"
                      required
                      value={form.stateCode}
                      onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="24"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city" className="text-[10px] font-bold uppercase text-muted-foreground">City *</Label>
                    <Input
                      id="city"
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="Surat"
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
                      <option value="regular">Regular</option>
                      <option value="composition">Composition</option>
                      <option value="export">Export</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TOGGLE FOR OPTIONAL DETAILS */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAllDetails(!showAllDetails)}
              className="w-full text-xs font-semibold uppercase tracking-wider h-8"
            >
              {showAllDetails ? "Hide More Details" : "Show More Details (Bank, Address, MSME...)"}
            </Button>
          </div>

          {/* OPTIONAL / ADVANCED DETAILS */}
          {showAllDetails && (
            <div className="space-y-5 pt-3 border-t">
              {/* Address & Contact */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-0.5">Address & Contact</h4>
                <div>
                  <Label htmlFor="address" className="text-[10px] font-bold uppercase text-muted-foreground">Address</Label>
                  <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="address"
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className="pl-9 h-9"
                      placeholder="e.g. Ring Road, Surat"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="pincode" className="text-[10px] font-bold uppercase text-muted-foreground">Pincode</Label>
                    <Input
                      id="pincode"
                      type="text"
                      value={form.pincode}
                      onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="395003"
                    />
                  </div>
                  <div>
                    <Label htmlFor="panNo" className="text-[10px] font-bold uppercase text-muted-foreground">PAN No.</Label>
                    <Input
                      id="panNo"
                      type="text"
                      value={form.panNo}
                      onChange={(e) => setForm((f) => ({ ...f, panNo: e.target.value.toUpperCase() }))}
                      className="h-9 mt-1"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="phone" className="text-[10px] font-bold uppercase text-muted-foreground">Phone</Label>
                    <Input
                      id="phone"
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-[10px] font-bold uppercase text-muted-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="info@acmefabrics.com"
                    />
                  </div>
                </div>
              </div>

              {/* Currency & Business Type */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-0.5">Business Config</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="currencySymbol" className="text-[10px] font-bold uppercase text-muted-foreground">Currency</Label>
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
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.symbol} value={c.symbol}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="nationName" className="text-[10px] font-bold uppercase text-muted-foreground">Nation</Label>
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
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.nation} value={c.nation}>
                          {c.nation}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="companyType" className="text-[10px] font-bold uppercase text-muted-foreground">Party Type</Label>
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
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="general">General / Standard</option>
                      <option value="textiles">Textiles</option>
                      <option value="diamond">Diamond</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="marketCategory" className="text-[10px] font-bold uppercase text-muted-foreground">Market Category</Label>
                    <select
                      id="marketCategory"
                      value={form.marketCategory}
                      onChange={(e) => setForm((f) => ({ ...f, marketCategory: e.target.value }))}
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {MARKET_CATEGORIES[form.companyType]?.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="financialYearStart" className="text-[10px] font-bold uppercase text-muted-foreground">FY Start</Label>
                  <Input
                    id="financialYearStart"
                    type="date"
                    value={form.financialYearStart}
                    onChange={(e) => setForm((f) => ({ ...f, financialYearStart: e.target.value }))}
                    className="h-9 mt-1"
                  />
                </div>
              </div>

              {/* MSME Section */}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="msmeType" className="text-[10px] font-bold uppercase text-muted-foreground">Category</Label>
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

                    <div>
                      <Label htmlFor="msmeNo" className="text-[10px] font-bold uppercase text-muted-foreground">Udyam No.</Label>
                      <Input
                        id="msmeNo"
                        type="text"
                        value={form.msmeNo}
                        onChange={(e) => setForm((f) => ({ ...f, msmeNo: e.target.value.toUpperCase() }))}
                        className="h-9 mt-1"
                        placeholder="UDYAM-GJ-01-0012345"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Information */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-0.5">Bank Information</h4>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Bank</Label>
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
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <Label htmlFor="bankName" className="text-[10px] font-bold uppercase text-muted-foreground">Bank Name</Label>
                    <Input
                      id="bankName"
                      type="text"
                      value={form.bankName}
                      onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bank Name</Label>
                    <span className="text-sm font-semibold text-foreground px-3 h-9 mt-1 flex items-center bg-muted/20 border rounded-md">
                      {form.bankName}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bankAccountName" className="text-[10px] font-bold uppercase text-muted-foreground">Account Name</Label>
                    <Input
                      id="bankAccountName"
                      type="text"
                      value={form.bankAccountName}
                      onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="e.g. Acme Fabrics"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountNo" className="text-[10px] font-bold uppercase text-muted-foreground">Account No.</Label>
                    <Input
                      id="accountNo"
                      type="text"
                      value={form.accountNo}
                      onChange={(e) => setForm((f) => ({ ...f, accountNo: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="e.g. 123456789012"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Select Branch / IFSC</Label>
                  {customBankActive ? (
                    <span className="text-xs text-muted-foreground px-3 h-9 mt-1 flex items-center bg-muted/10 border rounded-md select-none">
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
                      className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ifscCode" className="text-[10px] font-bold uppercase text-muted-foreground">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      type="text"
                      disabled={!customIfscActive}
                      value={form.ifscCode}
                      onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                      className="h-9 mt-1"
                      placeholder="e.g. SBIN0001234"
                    />
                  </div>

                  <div>
                    <Label htmlFor="branchName" className="text-[10px] font-bold uppercase text-muted-foreground">Branch Name</Label>
                    <Input
                      id="branchName"
                      type="text"
                      disabled={!customIfscActive}
                      value={form.branchName}
                      onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
                      className="h-9 mt-1"
                      placeholder="e.g. Ring Road Branch"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accountType" className="text-[10px] font-bold uppercase text-muted-foreground">Account Type</Label>
                  <select
                    id="accountType"
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="lg" className="px-4" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.companyName || (form.gstApplicable && (!form.gstNo || !form.stateCode || !form.city))} size="lg" className="px-4">
            {saving ? (
              <>
                <Spinner className="mr-2" />
                Saving
              </>
            ) : (
              "Create Party"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
