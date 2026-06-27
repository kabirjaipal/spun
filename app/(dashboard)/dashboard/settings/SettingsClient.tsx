"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BANK_LIST } from "@/lib/banks";

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
}

interface MasterCounts {
  customers: number;
  suppliers: number;
  products: number;
  ledgers: number;
  taxRates: number;
}

const MARKET_CATEGORIES: Record<string, string[]> = {
  textiles: ["Weaving", "Trading", "Processing", "Knitting", "Spinning", "Other"],
  diamond: ["Polished Diamonds", "Rough Diamonds", "Diamond Manufacturing", "Jewellery", "Other"],
  general: ["Retail", "Wholesale", "Services", "Manufacturing", "Distribution", "Other"],
};

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
  const [companyType, setCompanyType] = useState(company.companyType || "general");
  const [marketCategory, setMarketCategory] = useState(company.marketCategory || "Retail");
  
  // Bank details
  const [bankName, setBankName] = useState(company.bankName || "");
  const [bankAccountName, setBankAccountName] = useState(company.bankAccountName || "");
  const [accountNo, setAccountNo] = useState(company.accountNo || "");
  const [ifscCode, setIfscCode] = useState(company.ifscCode || "");
  const [branchName, setBranchName] = useState(company.branchName || "");
  const [accountType, setAccountType] = useState(company.accountType || "current");

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
          gstNo,
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

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Module / Type</Label>
            <select
              value={companyType}
              onChange={(e) => {
                const val = e.target.value;
                setCompanyType(val);
                setMarketCategory(MARKET_CATEGORIES[val][0]);
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="general">General / Standard</option>
              <option value="textiles">Textiles</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Category / Sub-Type</Label>
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

          <div className="border-t border-border pt-4 mt-4 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Bank Account Information</h3>
            
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Bank</Label>
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Name</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Name</Label>
                <span className="text-sm font-semibold text-foreground px-3 h-10 flex items-center bg-muted/20 border rounded-md">
                  {bankName}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Name</Label>
              <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="e.g. Acme Fabrics Pvt Ltd" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Number</Label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="e.g. 123456789012" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Branch / IFSC</Label>
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
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IFSC Code</Label>
              <Input disabled={!customIfscActive} value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch Name</Label>
              <Input disabled={!customIfscActive} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Ring Road Branch" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Type</Label>
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
