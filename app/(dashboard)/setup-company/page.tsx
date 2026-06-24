"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Building2, Landmark, MapPin, Calendar, FileText, ArrowRight } from "lucide-react";

export default function SetupCompanyPage() {
  const currentYear = new Date().getFullYear();
  const defaultFyStart = `${currentYear}-04-01`;

  const [companyName, setCompanyName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [panNo, setPanNo] = useState("");
  const [address, setAddress] = useState("");
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
          gstNo,
          panNo,
          address,
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
      <div className="lg:col-span-5 hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground relative select-none">
        {/* Soft Background Accent */}
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
      <div className="lg:col-span-7 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-8">
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

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Name */}
              <div className="col-span-1 sm:col-span-2">
                <label
                  htmlFor="companyName"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
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

              {/* GSTIN */}
              <div>
                <label
                  htmlFor="gstNo"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  GSTIN (OPTIONAL)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    id="gstNo"
                    type="text"
                    value={gstNo}
                    onChange={(e) => setGstNo(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                    placeholder="24AAAAB1234C1Z1"
                  />
                </div>
              </div>

              {/* PAN */}
              <div>
                <label
                  htmlFor="panNo"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  PAN NO. (OPTIONAL)
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

              {/* Financial Year Start */}
              <div className="col-span-1 sm:col-span-2">
                <label
                  htmlFor="financialYearStart"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
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

              {/* Address */}
              <div className="col-span-1 sm:col-span-2">
                <label
                  htmlFor="address"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  ADDRESS (OPTIONAL)
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
            </div>

            <div className="flex gap-4 pt-4">
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
