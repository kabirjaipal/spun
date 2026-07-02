"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function RegisterForm() {
  const [name, setName] = useState("");
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
      const signupRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await signupRes.json();

      if (!signupRes.ok) {
        throw new Error(data.message || "Failed to register");
      }

      // Auto login after signup
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Account created but auto-login failed. Please log in manually.");
      } else {
        router.push("/setup-company");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Column: Branding (hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-primary text-primary-foreground flex-col justify-between p-12 relative overflow-hidden select-none">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-foreground/10 blur-3xl" />
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
            Start Your Journey with {APP_NAME} Cloud ERP
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Set up your organization, configure allowed page roles, add warehouses, and begin managing your textile bookkeeping workflow in minutes.
          </p>

          {/* Bullet points */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Rapid Onboarding</h4>
                <p className="text-xs text-primary-foreground/70">Create your owner account and launch your business profile immediately.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Professional Invoice Prints</h4>
                <p className="text-xs text-primary-foreground/70">Pre-configured GST calculations with standard tax-rate lookup systems.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-primary-foreground/15 flex items-center justify-center text-xs font-bold text-primary-foreground">✓</div>
              <div>
                <h4 className="font-semibold text-sm">Always in Sync</h4>
                <p className="text-xs text-primary-foreground/70">Track live metrics across purchases, sales, and lot transfer movements.</p>
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
              Create your account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Or{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                sign in to an existing account
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
              <h3 className="text-xs font-bold text-foreground border-b border-border/50 pb-2 uppercase tracking-wide">
                USER DETAILS
              </h3>
              
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  FULL NAME
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  EMAIL ADDRESS
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
                >
                  PASSWORD
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full h-10 justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {loading ? "Registering..." : "CONTINUE TO SETUP COMPANY"}
              </button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-border"></div>
              <span className="shrink mx-4 text-muted-foreground text-xs uppercase font-semibold">or</span>
              <div className="grow border-t border-border"></div>
            </div>

            <div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await signIn("google", { callbackUrl: "/setup-company" });
                  } catch (err) {
                    setLoading(false);
                  }
                }}
                className="flex w-full h-10 justify-center items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
