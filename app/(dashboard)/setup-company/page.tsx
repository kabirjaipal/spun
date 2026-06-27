"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Building2, Landmark, MapPin, Calendar, FileText, ArrowRight, Phone, Mail, DollarSign, Globe } from "lucide-react";

const CURRENCIES = [
  { symbol: "₹", nation: "India", label: "₹ (INR - India)" },
  { symbol: "$", nation: "United States", label: "$ (USD - USA)" },
  { symbol: "£", nation: "United Kingdom", label: "£ (GBP - UK)" },
  { symbol: "€", nation: "Eurozone", label: "€ (EUR - Euro)" },
  { symbol: "¥", nation: "Japan", label: "¥ (JPY - Japan)" },
  { symbol: "A$", nation: "Australia", label: "A$ (AUD - Australia)" },
  { symbol: "C$", nation: "Canada", label: "C$ (CAD - Canada)" },
  { symbol: "CHF", nation: "Switzerland", label: "CHF (Swiss Franc)" },
  { symbol: "元", nation: "China", label: "元 (CNY - China)" },
  { symbol: "AED", nation: "United Arab Emirates", label: "AED (UAE Dirham)" },
];

export default function SetupCompanyPage() {
  const currentYear = new Date().getFullYear();
  const defaultFyStart = `${currentYear}-04-01`;

  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [nationName, setNationName] = useState("India");

  // GST details
  const [gstApplicable, setGstApplicable] = useState(false);
  const [gstNo, setGstNo] = useState("");
  const [panNo, setPanNo] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [gstType, setGstType] = useState("regular"); // regular, composition, export

  // Bank details
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState("current"); // current, cc, od, saving, other

  const [financialYearStart, setFinancialYearStart] = useState(defaultFyStart);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { update } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/setup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          address,
          pincode,
          state,
          phone,
          email,
          currencySymbol,
          nationName,
          bankName,
          bankAccountName,
          accountNo,
          ifscCode,
          branchName,
          accountType,
          gstApplicable,
          gstNo: gstApplicable ? gstNo : null,
          panNo,
          stateCode: gstApplicable ? stateCode : null,
          city: gstApplicable ? city : null,
          gstType: gstApplicable ? gstType : null,
          financialYearStart,
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
            <span className="font-bold text-lg tracking-wider">T</span>
          </div>
          <span className="text-xl font-bold tracking-wider">TEXORA</span>
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
          © {currentYear} Texora ERP. All rights reserved.
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
              Please enter your textile organization details to initialize your workspace.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger font-medium">
              {error}
            </div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Section 1: General Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2 text-foreground">General Details</h3>
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
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
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
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="e.g. Ring Road, Surat, India"
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
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
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
                    value={state}
                    onChange={(e) => setState(e.target.value)}
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      value={currencySymbol}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrencySymbol(val);
                        const match = CURRENCIES.find((c) => c.symbol === val);
                        if (match) {
                          setNationName(match.nation);
                        }
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
                      value={nationName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNationName(val);
                        const match = CURRENCIES.find((c) => c.nation === val);
                        if (match) {
                          setCurrencySymbol(match.symbol);
                        }
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
                      value={financialYearStart}
                      onChange={(e) => setFinancialYearStart(e.target.value)}
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
                    checked={gstApplicable}
                    onChange={(e) => setGstApplicable(e.target.checked)}
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
                      value={panNo}
                      onChange={(e) => setPanNo(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

                {gstApplicable && (
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
                          required={gstApplicable}
                          value={gstNo}
                          onChange={(e) => setGstNo(e.target.value)}
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
                        required={gstApplicable}
                        value={stateCode}
                        onChange={(e) => setStateCode(e.target.value)}
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
                        required={gstApplicable}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
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
                        value={gstType}
                        onChange={(e) => setGstType(e.target.value)}
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

            {/* Section 3: Bank Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2 text-foreground">Bank Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bankName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    BANK NAME
                  </label>
                  <input
                    id="bankName"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="e.g. State Bank of India"
                  />
                </div>

                <div>
                  <label htmlFor="bankAccountName" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ACCOUNT NAME
                  </label>
                  <input
                    id="bankAccountName"
                    type="text"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
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
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="e.g. 123456789012"
                  />
                </div>

                <div>
                  <label htmlFor="ifscCode" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    IFSC CODE
                  </label>
                  <input
                    id="ifscCode"
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
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
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="e.g. Ring Road Branch"
                  />
                </div>

                <div>
                  <label htmlFor="accountType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ACCOUNT TYPE
                  </label>
                  <select
                    id="accountType"
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
