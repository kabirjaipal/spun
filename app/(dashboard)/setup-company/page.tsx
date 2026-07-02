"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Building2, Landmark, MapPin, Calendar, FileText, ArrowRight, Phone, Mail, DollarSign, Globe, Trash2 } from "lucide-react";
import { BANK_LIST, type BankData } from "@/lib/banks";
import { CURRENCIES, MARKET_CATEGORIES, APP_NAME, STORAGE_BANKS_KEY } from "@/lib/constants";

interface CompanyFormState {
  companyName: string;
  address: string;
  pincode: string;
  state: string;
  phone: string;
  email: string;
  currencySymbol: string;
  nationName: string;
  companyType: string;
  marketCategory: string;
  financialYearStart: string;
  gstApplicable: boolean;
  panNo: string;
  gstNo: string;
  stateCode: string;
  city: string;
  gstType: string;
  bankName: string;
  bankAccountName: string;
  accountNo: string;
  ifscCode: string;
  branchName: string;
  accountType: string;
  selectedBankIndex: number | null;
  customBankActive: boolean;
  customIfscActive: boolean;
  msmeRegistered: boolean;
  msmeType: string;
  msmeNo: string;
}

const currentYear = new Date().getFullYear();
const defaultFyStart = `${currentYear}-04-01`;

const createEmptyCompanyState = (): CompanyFormState => ({
  companyName: "",
  address: "",
  pincode: "",
  state: "",
  phone: "",
  email: "",
  currencySymbol: "₹",
  nationName: "India",
  companyType: "general",
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
  selectedBankIndex: null,
  customBankActive: true,
  customIfscActive: true,
  msmeRegistered: false,
  msmeType: "micro",
  msmeNo: "",
});

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

export default function SetupCompanyPage() {
  const [companies, setCompanies] = useState<CompanyFormState[]>([createEmptyCompanyState()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { update } = useSession();

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

  const captureCustomBank = (companyState: CompanyFormState, currentBanks: BankData[]) => {
    if (
      companyState.customBankActive &&
      companyState.bankName.trim() &&
      companyState.branchName.trim() &&
      companyState.ifscCode.trim()
    ) {
      const bName = companyState.bankName.trim();
      const brName = companyState.branchName.trim();
      const ifsc = companyState.ifscCode.trim().toUpperCase();

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

  const handleSelectCompany = (targetIdx: number) => {
    const updatedBanks = captureCustomBank(companies[activeIdx], localBanks);
    if (updatedBanks) {
      saveCustomBanks(updatedBanks);
    }
    setActiveIdx(targetIdx);
  };

  const handleAddCompany = () => {
    const updatedBanks = captureCustomBank(companies[activeIdx], localBanks);
    if (updatedBanks) {
      saveCustomBanks(updatedBanks);
    }
    setCompanies(prev => [...prev, createEmptyCompanyState()]);
    setActiveIdx(companies.length);
  };

  const currentCompany = companies[activeIdx];
  const updateCurrent = (fields: Partial<CompanyFormState>) => {
    setCompanies(prev => prev.map((c, i) => i === activeIdx ? { ...c, ...fields } : c));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const missingNames = companies.some(c => !c.companyName.trim());
    if (missingNames) {
      setError("Company Name is required for all companies.");
      setLoading(false);
      return;
    }

    const updatedBanks = captureCustomBank(companies[activeIdx], localBanks);
    if (updatedBanks) {
      saveCustomBanks(updatedBanks);
    }

    try {
      const res = await fetch("/api/setup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: companies.map(c => ({
            companyName: c.companyName,
            address: c.address,
            pincode: c.pincode,
            state: c.state,
            phone: c.phone,
            email: c.email,
            currencySymbol: c.currencySymbol,
            nationName: c.nationName,
            gstApplicable: c.gstApplicable,
            gstNo: c.gstApplicable ? c.gstNo : null,
            panNo: c.panNo,
            stateCode: c.gstApplicable ? c.stateCode : null,
            city: c.gstApplicable ? c.city : null,
            gstType: c.gstApplicable ? c.gstType : null,
            bankName: c.bankName,
            bankAccountName: c.bankAccountName,
            accountNo: c.accountNo,
            ifscCode: c.ifscCode,
            branchName: c.branchName,
            accountType: c.accountType,
            financialYearStart: c.financialYearStart,
            companyType: c.companyType,
            marketCategory: c.marketCategory,
            msmeRegistered: c.msmeRegistered,
            msmeType: c.msmeRegistered ? c.msmeType : null,
            msmeNo: c.msmeRegistered ? c.msmeNo : null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set up company");

      // Update the session so the cookie is refreshed with the new companyId & role
      await update();
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-background">
      {/* Left Branding Pane */}
      <div className="lg:col-span-4 hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground relative select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)] pointer-events-none" />
        
        <div className="flex items-center gap-2 z-10">
          <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/10">
            <span className="font-bold text-lg tracking-wider">{APP_NAME.charAt(0)}</span>
          </div>
          <span className="text-xl font-bold tracking-wider uppercase">{APP_NAME}</span>
        </div>
        
        <div className="space-y-8 z-10">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Modern ERP for the Textile Industry
          </h1>
          <p className="text-lg text-primary-foreground/80 font-normal">
            Manage ledgers, track purchase and sales logs, run trial balances, and generate GST statements effortlessly.
          </p>
          <div className="space-y-4 pt-6 border-t border-primary-foreground/10 text-sm font-medium">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>GST Compliance & Audit Logs</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>Real-time Financial Balance sheets</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
              <span>Comprehensive Inventory & Stock logs</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-primary-foreground/60 z-10">
          © {currentYear} {APP_NAME} ERP. All rights reserved.
        </div>
      </div>

      {/* Right Form Pane */}
      <div className="lg:col-span-8 flex flex-col justify-start px-6 py-12 lg:px-16 overflow-y-auto max-h-screen">
        <div className="mx-auto w-full container space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              Register Your Company
            </h2>
            <p className="text-sm text-muted-foreground">
              Please enter your organization details to initialize your workspace. You can set up multiple companies now or manage them later.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger font-medium">
              {error}
            </div>
          )}

          {/* Companies Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-4">
            {companies.map((c, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-muted/20 p-1 rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => handleSelectCompany(idx)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                    idx === activeIdx
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.companyName.trim() || `Company ${idx + 1}`}
                  {idx === 0 && " (Primary)"}
                </button>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCompanies(prev => prev.filter((_, i) => i !== idx));
                      if (activeIdx >= idx) {
                        handleSelectCompany(Math.max(0, activeIdx - 1));
                      }
                    }}
                    className="p-1 text-muted-foreground hover:text-danger rounded hover:bg-danger/10"
                    title="Remove Company"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddCompany}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-dashed border-primary text-primary bg-background hover:bg-primary/5 transition-colors"
            >
              + Add Another Company
            </button>
          </div>

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Section 1: General Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2 text-foreground">
                General Details {companies.length > 1 && `(${currentCompany.companyName || `Company ${activeIdx + 1}`})`}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label htmlFor="companyName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    COMPANY NAME *
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={currentCompany.companyName}
                      onChange={(e) => updateCurrent({ companyName: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="e.g. Acme Fabrics Pvt Ltd"
                    />
                  </div>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label htmlFor="address" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ADDRESS
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="address"
                      type="text"
                      value={currentCompany.address}
                      onChange={(e) => updateCurrent({ address: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="e.g. 101, Textile Market"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="pincode" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    PINCODE
                  </label>
                  <input
                    id="pincode"
                    type="text"
                    value={currentCompany.pincode}
                    onChange={(e) => updateCurrent({ pincode: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="395003"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    STATE
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={currentCompany.state}
                    onChange={(e) => updateCurrent({ state: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="Gujarat"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    PHONE
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="phone"
                      type="text"
                      value={currentCompany.phone}
                      onChange={(e) => updateCurrent({ phone: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={currentCompany.email}
                      onChange={(e) => updateCurrent({ email: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="info@acmefabrics.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="currencySymbol" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    CURRENCY SYMBOL
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <select
                      id="currencySymbol"
                      value={currentCompany.currencySymbol}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = CURRENCIES.find((c) => c.symbol === val);
                        updateCurrent({
                          currencySymbol: val,
                          nationName: match ? match.nation : currentCompany.nationName,
                        });
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
                  <label htmlFor="nationName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    NATION NAME
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <select
                      id="nationName"
                      value={currentCompany.nationName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = CURRENCIES.find((c) => c.nation === val);
                        updateCurrent({
                          nationName: val,
                          currencySymbol: match ? match.symbol : currentCompany.currencySymbol,
                        });
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
                  <label htmlFor="companyType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    COMPANY MODULE / TYPE *
                  </label>
                  <select
                    id="companyType"
                    value={currentCompany.companyType}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateCurrent({
                        companyType: val,
                        marketCategory: MARKET_CATEGORIES[val][0],
                      });
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="general">General / Standard</option>
                    <option value="textiles">Textiles</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="marketCategory" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    MARKET CATEGORY / SUB-TYPE *
                  </label>
                  <select
                    id="marketCategory"
                    value={currentCompany.marketCategory}
                    onChange={(e) => updateCurrent({ marketCategory: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {MARKET_CATEGORIES[currentCompany.companyType]?.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label htmlFor="financialYearStart" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    FINANCIAL YEAR START *
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="financialYearStart"
                      type="date"
                      required
                      value={currentCompany.financialYearStart}
                      onChange={(e) => updateCurrent({ financialYearStart: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Taxation Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2 text-foreground flex items-center justify-between">
                <span>GST & Taxation</span>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-normal text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={currentCompany.gstApplicable}
                    onChange={(e) => updateCurrent({ gstApplicable: e.target.checked })}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                  />
                  GST Applicable
                </label>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="panNo" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    PAN NO.
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                      id="panNo"
                      type="text"
                      value={currentCompany.panNo}
                      onChange={(e) => updateCurrent({ panNo: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                {currentCompany.gstApplicable && (
                  <>
                    <div>
                      <label htmlFor="gstNo" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        GSTIN
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <input
                          id="gstNo"
                          type="text"
                          required={currentCompany.gstApplicable}
                          value={currentCompany.gstNo}
                          onChange={(e) => updateCurrent({ gstNo: e.target.value })}
                          className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                          placeholder="24AAAAB1234C1Z1"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="stateCode" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        STATE CODE
                      </label>
                      <input
                        id="stateCode"
                        type="text"
                        required={currentCompany.gstApplicable}
                        value={currentCompany.stateCode}
                        onChange={(e) => updateCurrent({ stateCode: e.target.value })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                        placeholder="24"
                      />
                    </div>

                    <div>
                      <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        CITY
                      </label>
                      <input
                        id="city"
                        type="text"
                        required={currentCompany.gstApplicable}
                        value={currentCompany.city}
                        onChange={(e) => updateCurrent({ city: e.target.value })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                        placeholder="Surat"
                      />
                    </div>

                    <div>
                      <label htmlFor="gstType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        REGISTRATION TYPE
                      </label>
                      <select
                        id="gstType"
                        value={currentCompany.gstType}
                        onChange={(e) => updateCurrent({ gstType: e.target.value })}
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
              <h3 className="text-lg font-bold border-b pb-2 text-foreground flex items-center justify-between">
                <span>MSME Registration</span>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-normal text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={currentCompany.msmeRegistered}
                    onChange={(e) => updateCurrent({ msmeRegistered: e.target.checked })}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
                  />
                  MSME Registered
                </label>
              </h3>

              {currentCompany.msmeRegistered && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="msmeType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      MSME CATEGORY
                    </label>
                    <select
                      id="msmeType"
                      value={currentCompany.msmeType}
                      onChange={(e) => updateCurrent({ msmeType: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="micro">Micro</option>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="msmeNo" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      UDYAM REGISTRATION NUMBER
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <input
                        id="msmeNo"
                        type="text"
                        value={currentCompany.msmeNo}
                        onChange={(e) => updateCurrent({ msmeNo: e.target.value.toUpperCase() })}
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
              <h3 className="text-lg font-bold border-b pb-2 text-foreground">Bank Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    SELECT BANK
                  </label>
                  <select
                    value={currentCompany.customBankActive ? "custom" : currentCompany.selectedBankIndex ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        updateCurrent({
                          customBankActive: true,
                          customIfscActive: true,
                          bankName: "",
                          ifscCode: "",
                          branchName: "",
                          selectedBankIndex: null,
                        });
                      } else {
                        const bankIndex = Number(val);
                        const bank = localBanks[bankIndex];
                        updateCurrent({
                          customBankActive: false,
                          customIfscActive: false,
                          bankName: bank.bankName,
                          selectedBankIndex: bankIndex,
                          ifscCode: bank.branches.length > 0 ? bank.branches[0].ifscCode : "",
                          branchName: bank.branches.length > 0 ? bank.branches[0].branchName : "",
                        });
                      }
                    }}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="custom">Other / Custom Bank</option>
                    {localBanks.map((b, idx) => (
                      <option key={b.bankName} value={idx}>
                        {b.bankName}
                      </option>
                    ))}
                  </select>
                </div>

                {currentCompany.customBankActive ? (
                  <div>
                    <label htmlFor="bankName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      BANK NAME
                    </label>
                    <input
                      id="bankName"
                      type="text"
                      value={currentCompany.bankName}
                      onChange={(e) => updateCurrent({ bankName: e.target.value })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      BANK NAME
                    </label>
                    <span className="text-sm font-semibold text-foreground px-3 h-10 flex items-center bg-muted/20 border rounded-md">
                      {currentCompany.bankName}
                    </span>
                  </div>
                )}

                <div>
                  <label htmlFor="bankAccountName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ACCOUNT NAME
                  </label>
                  <input
                    id="bankAccountName"
                    type="text"
                    value={currentCompany.bankAccountName}
                    onChange={(e) => updateCurrent({ bankAccountName: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="e.g. Acme Fabrics Pvt Ltd"
                  />
                </div>

                <div>
                  <label htmlFor="accountNo" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ACCOUNT NUMBER
                  </label>
                  <input
                    id="accountNo"
                    type="text"
                    value={currentCompany.accountNo}
                    onChange={(e) => updateCurrent({ accountNo: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="e.g. 123456789012"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    SELECT BRANCH / IFSC
                  </label>
                  {currentCompany.customBankActive ? (
                    <span className="text-sm text-muted-foreground px-3 h-10 flex items-center bg-muted/10 border rounded-md select-none">
                      Type custom details below
                    </span>
                  ) : (
                    <select
                      value={currentCompany.customIfscActive ? "custom" : localBanks[currentCompany.selectedBankIndex!].branches.findIndex(b => b.ifscCode === currentCompany.ifscCode)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          updateCurrent({
                            customIfscActive: true,
                            ifscCode: "",
                            branchName: "",
                          });
                        } else {
                          const branchIndex = Number(val);
                          const branch = localBanks[currentCompany.selectedBankIndex!].branches[branchIndex];
                          updateCurrent({
                            customIfscActive: false,
                            ifscCode: branch.ifscCode,
                            branchName: branch.branchName,
                          });
                        }
                      }}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {localBanks[currentCompany.selectedBankIndex!].branches.map((b, idx) => (
                        <option key={b.ifscCode} value={idx}>
                          {b.branchName} ({b.ifscCode})
                        </option>
                      ))}
                      <option value="custom">Other / Custom Branch</option>
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="ifscCode" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    IFSC CODE
                  </label>
                  <input
                    id="ifscCode"
                    type="text"
                    disabled={!currentCompany.customIfscActive}
                    value={currentCompany.ifscCode}
                    onChange={(e) => updateCurrent({ ifscCode: e.target.value.toUpperCase() })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:text-muted-foreground"
                    placeholder="e.g. SBIN0001234"
                  />
                </div>

                <div>
                  <label htmlFor="branchName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    BRANCH NAME
                  </label>
                  <input
                    id="branchName"
                    type="text"
                    disabled={!currentCompany.customIfscActive}
                    value={currentCompany.branchName}
                    onChange={(e) => updateCurrent({ branchName: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 disabled:bg-muted/30 disabled:text-muted-foreground"
                    placeholder="e.g. Ring Road Branch"
                  />
                </div>

                <div>
                  <label htmlFor="accountType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ACCOUNT TYPE
                  </label>
                  <select
                    id="accountType"
                    value={currentCompany.accountType}
                    onChange={(e) => updateCurrent({ accountType: e.target.value })}
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

            <div className="flex gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => signOut()}
                className="flex-1 h-10 rounded-md border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                SIGN OUT
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
              >
                <span>{loading ? "Registering..." : "COMPLETE SETUP"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
