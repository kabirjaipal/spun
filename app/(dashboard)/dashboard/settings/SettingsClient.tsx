"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BANK_LIST } from "@/lib/banks";
import { CURRENCIES, MARKET_CATEGORIES } from "@/lib/constants";

interface CompanyDetails {
  companyId: number;
  companyName: string;
  gstNo: string | null;
  panNo: string | null;
  address: string | null;
  financialYearStart: string | null;
  companyType: string;
  marketCategory: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  branchName: string | null;
  accountType: string | null;
  msmeRegistered: boolean;
  msmeType: string | null;
  msmeNo: string | null;
  phone: string | null;
  email: string | null;
  pincode: string | null;
  state: string | null;
  stateCode: string | null;
  city: string | null;
  nationName: string | null;
  currencySymbol: string | null;
  gstApplicable: boolean;
  gstType: string | null;
}

export default function SettingsClient({
  company,
}: {
  company: CompanyDetails;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(company.companyName);
  const [gstNo, setGstNo] = useState(company.gstNo || "");
  const [panNo, setPanNo] = useState(company.panNo || "");
  const [address, setAddress] = useState(company.address || "");
  const [financialYearStart, setFinancialYearStart] = useState(company.financialYearStart || "");
  const [companyType, setCompanyType] = useState(company.companyType || "general");
  const [marketCategory, setMarketCategory] = useState(company.marketCategory || "Retail");
  const [phone, setPhone] = useState(company.phone || "");
  const [email, setEmail] = useState(company.email || "");
  const [pincode, setPincode] = useState(company.pincode || "");
  const [state, setState] = useState(company.state || "");
  const [stateCode, setStateCode] = useState(company.stateCode || "");
  const [city, setCity] = useState(company.city || "");
  const [nationName, setNationName] = useState(company.nationName || "India");
  const [currencySymbol, setCurrencySymbol] = useState(company.currencySymbol || "₹");
  const [gstApplicable, setGstApplicable] = useState(company.gstApplicable || false);
  const [gstType, setGstType] = useState(company.gstType || "regular");

  // Bank details
  const [bankName, setBankName] = useState(company.bankName || "");
  const [bankAccountName, setBankAccountName] = useState(company.bankAccountName || "");
  const [accountNo, setAccountNo] = useState(company.accountNo || "");
  const [ifscCode, setIfscCode] = useState(company.ifscCode || "");
  const [branchName, setBranchName] = useState(company.branchName || "");
  const [accountType, setAccountType] = useState(company.accountType || "current");
  const [msmeRegistered, setMsmeRegistered] = useState(company.msmeRegistered);
  const [msmeType, setMsmeType] = useState(company.msmeType || "micro");
  const [msmeNo, setMsmeNo] = useState(company.msmeNo || "");

  // Determine initial bank selection state helpers
  const initialBankIndex = BANK_LIST.findIndex(b => b.bankName === company.bankName);
  const isPreseededBank = initialBankIndex !== -1;
  const isPreseededIfsc = isPreseededBank && BANK_LIST[initialBankIndex].branches.some(br => br.ifscCode === company.ifscCode);

  const [selectedBankIndex, setSelectedBankIndex] = useState<number | null>(isPreseededBank ? initialBankIndex : null);
  const [customBankActive, setCustomBankActive] = useState(!isPreseededBank);
  const [customIfscActive, setCustomIfscActive] = useState(!isPreseededIfsc);

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
          gstNo: gstApplicable ? gstNo : null,
          panNo,
          address,
          financialYearStart,
          companyType,
          marketCategory,
          bankName,
          bankAccountName,
          accountNo,
          ifscCode,
          branchName,
          accountType,
          msmeRegistered,
          msmeType: msmeRegistered ? msmeType : null,
          msmeNo: msmeRegistered ? msmeNo : null,
          phone,
          email,
          pincode,
          state,
          stateCode,
          city,
          nationName,
          currencySymbol,
          gstApplicable,
          gstType: gstApplicable ? gstType : null,
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
        <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Company Settings</h1>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      <div className="w-full">
        {/* Profile Settings */}
        <form onSubmit={handleSave} className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">Company Profile Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Company Module / Type</Label>
              <select
                value={companyType}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompanyType(val);
                  setMarketCategory(MARKET_CATEGORIES[val]?.[0] || "");
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="general">General / Standard</option>
                <option value="textiles">Textiles</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Market Category / Sub-Type</Label>
              <select
                value={marketCategory}
                onChange={(e) => setMarketCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MARKET_CATEGORIES[companyType]?.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <Input type="date" value={financialYearStart} onChange={(e) => setFinancialYearStart(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 99999 99999" />
            </div>

            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" />
            </div>

            <div className="space-y-2">
              <Label>Nation Name</Label>
              <select
                value={nationName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNationName(val);
                  const match = CURRENCIES.find((c) => c.nation === val);
                  if (match) {
                    setCurrencySymbol(match.symbol);
                  }
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.nation} value={c.nation}>
                    {c.nation}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <select
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur.symbol} value={cur.symbol}>
                    {cur.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-2 border-b border-border">Address & Location</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Company Head Office address" />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat" />
            </div>

            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="395003" />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Gujarat" />
            </div>

            <div className="space-y-2">
              <Label>State Code</Label>
              <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="24" />
            </div>
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-2 border-b border-border">GST Details</h2>
          
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground select-none font-semibold">
              <input
                type="checkbox"
                checked={gstApplicable}
                onChange={(e) => setGstApplicable(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary"
              />
              GST Applicable
            </label>

            {gstApplicable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GST Registration Type</Label>
                  <select
                    value={gstType}
                    onChange={(e) => setGstType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="regular">Regular</option>
                    <option value="composition">Composition</option>
                    <option value="export">Export / SEZ</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={gstNo} onChange={(e) => setGstNo(e.target.value.toUpperCase())} placeholder="24AAAAA0000A1Z5" />
                </div>
              </div>
            )}

            <div className="space-y-2 max-w-sm">
              <Label>PAN</Label>
              <Input value={panNo} onChange={(e) => setPanNo(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
            </div>
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-2 border-b border-border">MSME Details</h2>
          
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground select-none font-semibold">
              <input
                type="checkbox"
                checked={msmeRegistered}
                onChange={(e) => setMsmeRegistered(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary"
              />
              MSME Registered
            </label>

            {msmeRegistered && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>MSME Category</Label>
                  <select
                    value={msmeType}
                    onChange={(e) => setMsmeType(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="micro">Micro</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Udyam Registration No.</Label>
                  <Input
                    value={msmeNo}
                    onChange={(e) => setMsmeNo(e.target.value.toUpperCase())}
                    placeholder="UDYAM-GJ-01-0012345"
                  />
                </div>
              </div>
            )}
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-4 pb-2 border-b border-border">Bank Account Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Bank</Label>
              <select
                value={customBankActive ? "custom" : selectedBankIndex ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "custom") {
                    setCustomBankActive(true);
                    setCustomIfscActive(true);
                    setBankName("");
                    setIfscCode("");
                    setBranchName("");
                    setSelectedBankIndex(null);
                  } else {
                    setCustomBankActive(false);
                    setCustomIfscActive(false);
                    const bankIndex = Number(val);
                    const bank = BANK_LIST[bankIndex];
                    setBankName(bank.bankName);
                    setSelectedBankIndex(bankIndex);
                    
                    if (bank.branches.length > 0) {
                      setIfscCode(bank.branches[0].ifscCode);
                      setBranchName(bank.branches[0].branchName);
                    } else {
                      setIfscCode("");
                      setBranchName("");
                    }
                  }
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="custom">Other / Custom Bank</option>
                {BANK_LIST.map((b, idx) => (
                  <option key={b.bankName} value={idx}>
                    {b.bankName}
                  </option>
                ))}
              </select>
            </div>

            {customBankActive ? (
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <span className="text-sm font-semibold text-foreground px-3 h-10 flex items-center bg-muted/20 border rounded-md">
                  {bankName}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="e.g. Acme Fabrics Pvt Ltd" />
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="e.g. 123456789012" />
            </div>

            <div className="space-y-2">
              <Label>Select Branch / IFSC</Label>
              {customBankActive ? (
                <span className="text-sm text-muted-foreground px-3 h-10 flex items-center bg-muted/10 border rounded-md select-none">
                  Type custom details below
                </span>
              ) : (
                <select
                  value={customIfscActive ? "custom" : BANK_LIST[selectedBankIndex!].branches.findIndex(b => b.ifscCode === ifscCode)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setCustomIfscActive(true);
                      setIfscCode("");
                      setBranchName("");
                    } else {
                      setCustomIfscActive(false);
                      const branchIndex = Number(val);
                      const branch = BANK_LIST[selectedBankIndex!].branches[branchIndex];
                      setIfscCode(branch.ifscCode);
                      setBranchName(branch.branchName);
                    }
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {BANK_LIST[selectedBankIndex!].branches.map((b, idx) => (
                    <option key={b.ifscCode} value={idx}>
                      {b.branchName} ({b.ifscCode})
                    </option>
                  ))}
                  <option value="custom">Other / Custom Branch</option>
                </select>
              )}
            </div>

            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input disabled={!customIfscActive} value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" />
            </div>

            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input disabled={!customIfscActive} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Ring Road Branch" />
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
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

          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Saving Profile
                </>
              ) : (
                "Save Profile Details"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
