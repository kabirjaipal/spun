"use client";

import React, { useState } from "react";
import {
  Menu,
  Building2,
  Plus,
  MapPin,
  Calendar,
  FileText,
  Phone,
  Mail,
  DollarSign,
  Globe,
  Landmark,
  Search,
} from "lucide-react";
import { useSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CURRENCIES, MARKET_CATEGORIES } from "@/lib/constants";
import { fetchGstDetails } from "@/lib/utils";

interface DashboardHeaderProps {
  companyName: string;
  financialYearStart: string | null;
  userCompanies?: { companyId: number; companyName: string }[];
  currentCompanyId?: number | null;
}

export default function DashboardHeader({
  companyName,
  financialYearStart,
  userCompanies = [],
  currentCompanyId = null,
}: DashboardHeaderProps) {
  const { setIsMobileOpen } = useSidebar();
  const { update } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // New Company form states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fetchingGst, setFetchingGst] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultFyStart = new Date().getMonth() >= 3 
    ? `${new Date().getFullYear()}-04-01`
    : `${new Date().getFullYear() - 1}-04-01`;

  const [form, setForm] = useState({
    companyName: "",
    address: "",
    pincode: "",
    state: "",
    phone: "",
    email: "",
    currencySymbol: "₹",
    nationName: "India",
    companyType: "general",
    jobPartyType: "trader",
    marketCategory: "Retail",
    financialYearStart: defaultFyStart,
    gstApplicable: false,
    panNo: "",
    gstNo: "",
    stateCode: "",
    city: "",
    gstType: "regular",
    bankName: "",
    bankAccountName: "",
    accountNo: "",
    ifscCode: "",
    branchName: "",
    accountType: "current",
    msmeRegistered: false,
    msmeType: "micro",
    msmeNo: "",
  });

  const handleCompanySwitch = async (newCompanyIdStr: string) => {
    const newCompanyId = Number(newCompanyIdStr);
    if (newCompanyId === currentCompanyId || switching) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/users/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: newCompanyId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to switch company");
      }

      await update();
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "An error occurred while switching company.");
    } finally {
      setSwitching(false);
    }
  };

  const handleFetchGST = async (gstNo: string) => {
    if (!gstNo) return;
    setFetchingGst(true);
    setError(null);
    try {
      const d = await fetchGstDetails(gstNo);
      const newCompName = d.companyName || form.companyName;
      setForm((f) => ({
        ...f,
        gstNo: d.gstin,
        companyName: newCompName.toUpperCase(),
        panNo: d.panNo || f.panNo,
        stateCode: d.stateCode || f.stateCode,
        state: d.state || f.state,
        city: d.city || f.city,
        address: d.address || f.address,
        pincode: d.pincode || f.pincode,
        gstType: d.gstType || f.gstType,
        bankAccountName: newCompName.toUpperCase(),
      }));
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching GST details.");
    } finally {
      setFetchingGst(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      setError("Company Name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create company");
      }

      const newComp = await res.json();
      const newCompanyId = Number(newComp.companyId);

      const switchRes = await fetch("/api/users/switch-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: newCompanyId }),
      });

      if (!switchRes.ok) {
        const switchData = await switchRes.json();
        throw new Error(switchData.error || "Failed to switch context to new company");
      }

      await update();
      setIsDialogOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between rounded-lg border border-border bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open Sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Building2 className="h-4 w-4 text-primary" />
        
        {userCompanies.length >= 1 ? (
          <div className="flex items-center gap-2">
            <Select
              disabled={switching}
              value={currentCompanyId ? String(currentCompanyId) : undefined}
              onValueChange={handleCompanySwitch}
            >
              <SelectTrigger className="h-9 border border-input px-3 text-sm font-semibold uppercase tracking-wider text-foreground min-w-[150px]">
                <SelectValue placeholder="Select Company" />
              </SelectTrigger>
              <SelectContent>
                {userCompanies.map((c) => (
                  <SelectItem key={c.companyId} value={String(c.companyId)}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {switching && <span className="text-xs text-muted-foreground animate-pulse font-medium">Switching...</span>}
          </div>
        ) : (
          <h1 className="text-sm font-bold text-foreground uppercase tracking-wider truncate max-w-[200px] sm:max-w-none">
            {companyName}
          </h1>
        )}

        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            setForm({
              companyName: "",
              address: "",
              pincode: "",
              state: "",
              phone: "",
              email: "",
              currencySymbol: "₹",
              nationName: "India",
              companyType: "general",
              jobPartyType: "trader",
              marketCategory: "Retail",
              financialYearStart: defaultFyStart,
              gstApplicable: false,
              panNo: "",
              gstNo: "",
              stateCode: "",
              city: "",
              gstType: "regular",
              bankName: "",
              bankAccountName: "",
              accountNo: "",
              ifscCode: "",
              branchName: "",
              accountType: "current",
              msmeRegistered: false,
              msmeType: "micro",
              msmeNo: "",
            });
            setIsDialogOpen(true);
          }}
          className="h-9 border border-input text-sm font-semibold text-foreground hover:bg-muted ml-2"
        >
          <Plus className="h-4 w-4 mr-1 text-primary" />
          Add Company
        </Button>
      </div>

      {financialYearStart && (
        <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          <span className="hidden sm:inline">FINANCIAL YEAR START: </span>
          <span className="text-foreground">{financialYearStart}</span>
        </div>
      )}

      {/* New Company Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border p-6 md:p-8">
          <DialogHeader className="border-b border-border pb-4 mb-4">
            <DialogTitle className="text-xl font-extrabold text-foreground uppercase tracking-wider">REGISTER YOUR COMPANY</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please enter your organization details to initialize a new company workspace.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: General Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2 text-foreground uppercase tracking-wider">
                General Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="companyName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Company Name *
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="companyName"
                      type="text"
                      required
                      value={form.companyName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((f) => ({ ...f, companyName: val.toUpperCase(), bankAccountName: val.toUpperCase() }));
                      }}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="E.G. ACME FABRICS PVT LTD"
                    />
                  </div>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="address" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Address
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="address"
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="E.G. 101, TEXTILE MARKET"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pincode" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Pincode
                  </Label>
                  <Input
                    id="pincode"
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="395003"
                  />
                </div>

                <div>
                  <Label htmlFor="state" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    State
                  </Label>
                  <Input
                    id="state"
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="GUJARAT"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Phone
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="phone"
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Email Address
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase() }))}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="info@acmefabrics.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="currencySymbol" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Currency Symbol
                  </Label>
                  <div className="relative">
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
                  <Label htmlFor="nationName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Nation Name
                  </Label>
                  <div className="relative">
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
                  <Label htmlFor="companyType" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Company Module / Type *
                  </Label>
                  <select
                    id="companyType"
                    value={form.companyType}
                    onChange={(e) => {
                      const val = e.target.value;
                      const categories = MARKET_CATEGORIES[val as keyof typeof MARKET_CATEGORIES] || [];
                      setForm((f) => ({
                        ...f,
                        companyType: val,
                        marketCategory: categories[0] || "",
                      }));
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="general">General / Standard</option>
                    <option value="textiles">Textiles</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="jobPartyType" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Job Party Type *
                  </Label>
                  <select
                    id="jobPartyType"
                    value={form.jobPartyType}
                    onChange={(e) => setForm((f) => ({ ...f, jobPartyType: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="trader">Trader (Outward Lot First)</option>
                    <option value="process_house">Process House (Inward Lot First)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="marketCategory" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Market Category / Sub-Type *
                  </Label>
                  <select
                    id="marketCategory"
                    value={form.marketCategory}
                    onChange={(e) => setForm((f) => ({ ...f, marketCategory: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {MARKET_CATEGORIES[form.companyType as keyof typeof MARKET_CATEGORIES]?.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <Label htmlFor="financialYearStart" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Financial Year Start *
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="financialYearStart"
                      type="date"
                      required
                      value={form.financialYearStart}
                      onChange={(e) => setForm((f) => ({ ...f, financialYearStart: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Taxation Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2 text-foreground flex items-center justify-between uppercase tracking-wider">
                <span>GST & Taxation</span>
                <Label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.gstApplicable}
                    onChange={(e) => setForm((f) => ({ ...f, gstApplicable: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background cursor-pointer"
                  />
                  GST Applicable
                </Label>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="panNo" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    PAN No.
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="panNo"
                      type="text"
                      value={form.panNo}
                      onChange={(e) => setForm((f) => ({ ...f, panNo: e.target.value.toUpperCase() }))}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                {form.gstApplicable && (
                  <>
                    <div>
                      <Label htmlFor="gstNo" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        GSTIN
                      </Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <Input
                          id="gstNo"
                          type="text"
                          required={form.gstApplicable}
                          value={form.gstNo}
                          onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value.toUpperCase() }))}
                          className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-10 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                          placeholder="24AAAAB1234C1Z1"
                        />
                        {form.gstNo && form.gstNo.trim().length >= 15 && (
                          <Button
                            type="button"
                            onClick={() => handleFetchGST(form.gstNo)}
                            disabled={fetchingGst}
                            variant="ghost"
                            className="absolute inset-y-0 right-0 h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
                            title="Fetch Details"
                          >
                            {fetchingGst ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="stateCode" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        State Code
                      </Label>
                      <Input
                        id="stateCode"
                        type="text"
                        required={form.gstApplicable}
                        value={form.stateCode}
                        onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                        placeholder="24"
                      />
                    </div>

                    <div>
                      <Label htmlFor="city" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        City
                      </Label>
                      <Input
                        id="city"
                        type="text"
                        required={form.gstApplicable}
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                        placeholder="SURAT"
                      />
                    </div>

                    <div>
                      <Label htmlFor="gstType" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Registration Type
                      </Label>
                      <select
                        id="gstType"
                        value={form.gstType}
                        onChange={(e) => setForm((f) => ({ ...f, gstType: e.target.value }))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

            {/* Section 3: MSME Registration */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2 text-foreground flex items-center justify-between uppercase tracking-wider">
                <span>MSME Registration</span>
                <Label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.msmeRegistered}
                    onChange={(e) => setForm((f) => ({ ...f, msmeRegistered: e.target.checked }))}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background cursor-pointer"
                  />
                  MSME Registered
                </Label>
              </h3>

              {form.msmeRegistered && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="msmeType" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      MSME Category
                    </Label>
                    <select
                      id="msmeType"
                      value={form.msmeType}
                      onChange={(e) => setForm((f) => ({ ...f, msmeType: e.target.value }))}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="micro">Micro</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="msmeNo" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Udyam Registration Number
                    </Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="msmeNo"
                        type="text"
                        value={form.msmeNo}
                        onChange={(e) => setForm((f) => ({ ...f, msmeNo: e.target.value.toUpperCase() }))}
                        className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                        placeholder="UDYAM-GJ-01-0012345"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Bank Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b border-border pb-2 text-foreground uppercase tracking-wider">
                Bank Account Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bankName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Bank Name
                  </Label>
                  <Input
                    id="bankName"
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="E.G. STATE BANK OF INDIA"
                  />
                </div>

                <div>
                  <Label htmlFor="bankAccountName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Account Name
                  </Label>
                  <Input
                    id="bankAccountName"
                    type="text"
                    value={form.bankAccountName}
                    onChange={(e) => setForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="E.G. ACME FABRICS PVT LTD"
                  />
                </div>

                <div>
                  <Label htmlFor="accountNo" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Account Number
                  </Label>
                  <Input
                    id="accountNo"
                    type="text"
                    value={form.accountNo}
                    onChange={(e) => setForm((f) => ({ ...f, accountNo: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="E.G. 123456789012"
                  />
                </div>

                <div>
                  <Label htmlFor="ifscCode" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    IFSC Code
                  </Label>
                  <Input
                    id="ifscCode"
                    type="text"
                    value={form.ifscCode}
                    onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="E.G. SBIN0001234"
                  />
                </div>

                <div>
                  <Label htmlFor="branchName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Branch Name
                  </Label>
                  <Input
                    id="branchName"
                    type="text"
                    value={form.branchName}
                    onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="E.G. RING ROAD BRANCH"
                  />
                </div>

                <div>
                  <Label htmlFor="accountType" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Account Type
                  </Label>
                  <select
                    id="accountType"
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

            {/* Form Footer */}
            <DialogFooter className="border-t border-border pt-4 flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="h-10 text-sm font-semibold uppercase tracking-wider border border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-10 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 uppercase tracking-wider"
              >
                {submitting ? "Creating..." : "Save Company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
