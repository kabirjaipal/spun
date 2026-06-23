"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function SetupCompanyPage() {
  const [companyName, setCompanyName] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [address, setAddress] = useState("");
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
        body: JSON.stringify({ companyName, gstNo, address }),
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Set up your company
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please register your textile company to start using Texora.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="companyName"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
              >
                COMPANY NAME
              </label>
              <input
                id="companyName"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Acme Fabrics"
              />
            </div>

            <div>
              <label
                htmlFor="gstNo"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
              >
                GSTIN (OPTIONAL)
              </label>
              <input
                id="gstNo"
                type="text"
                value={gstNo}
                onChange={(e) => setGstNo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="24AAAAB1234C1Z1"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
              >
                ADDRESS (OPTIONAL)
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Surat, India"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex-1 rounded-md border border-border bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              SIGN OUT
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving..." : "SUBMIT"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
