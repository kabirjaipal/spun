"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl") || "/dashboard";
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Column: Hero Sidebar */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative subtle background shapes */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-secondary/10 blur-3xl" />
        
        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary-foreground text-primary text-xl font-bold shadow-md">
            {APP_NAME.charAt(0)}
          </div>
          <span className="font-bold text-lg uppercase tracking-wider">{APP_NAME} ERP</span>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            The Intelligent Core for Your Textile Business
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Manage production lot shortages, double-entry bookkeeping, logistics dispatch, and invoice workflows all in one unified, real-time platform.
          </p>

          {/* Bullet points */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Automated Shortage Logs</h4>
                <p className="text-xs text-primary-foreground/70">Instantly track inward vs. outward job work discrepancies.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Tally-Standard Ledger Engine</h4>
                <p className="text-xs text-primary-foreground/70">Execute general entries, debit/credit notes with automatic GST calculations.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Multi-Tenant Security</h4>
                <p className="text-xs text-primary-foreground/70">Securely assign roles, manage branch companies, and access control lists.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer details */}
        <div className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved. Trusted by modern textile mills and traders globally.
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 bg-card rounded-xl border border-border p-8 shadow-sm">
          <div className="text-center lg:text-left">
            <div className="lg:hidden inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground shadow-sm mb-4">
              {APP_NAME.charAt(0)}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Or{" "}
              <Link
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                register a new business account
              </Link>
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger animate-shake">
              {error}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="block mb-1" >
                  EMAIL ADDRESS
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <Label htmlFor="password" className="block mb-1" >
                  PASSWORD
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Signing in..." : "SIGN IN"}
              </Button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-border"></div>
              <span className="shrink mx-4 text-muted-foreground text-xs uppercase font-semibold">or</span>
              <div className="grow border-t border-border"></div>
            </div>

            <div>
              <Button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const params = new URLSearchParams(window.location.search);
                    const callbackUrl = params.get("callbackUrl") || "/dashboard";
                    await signIn("google", { callbackUrl });
                  } catch (err) {
                    setLoading(false);
                  }
                }}
                variant="secondary" className="w-full"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.8 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,20.8c2.38,0 4.38,-0.79 5.84,-2.15l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.34,0.98 -2.57,0 -4.75,-1.74 -5.53,-4.07H2.27v2.66C3.73,18.52 7.57,20.8 12,20.8z" fill="#34A853" />
                    <path d="M6.47,13c-0.2,-0.61 -0.31,-1.27 -0.31,-1.95s0.11,-1.34 0.31,-1.95V6.44H2.27C1.57,7.85 1.18,9.43 1.18,11.1s0.39,3.25 1.09,4.66L6.47,13z" fill="#FBBC05" />
                    <path d="M12,6.13c1.3,0 2.46,0.45 3.38,1.32l2.53,-2.53C16.38,3.48 14.38,2.7 12,2.7 7.57,2.7 3.73,4.98 2.27,7.84l4.2,3.26c0.78,-2.33 2.96,-4.07 5.53,-4.07z" fill="#EA4335" />
                  </g>
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
