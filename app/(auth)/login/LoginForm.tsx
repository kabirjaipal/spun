"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            T
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
            Sign in to Texora
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              create a new account and company
            </Link>
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
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
              >
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@example.com"
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
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Signing in..." : "SIGN IN"}
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
                  await signIn("google", { callbackUrl: "/dashboard" });
                } catch (err) {
                  setLoading(false);
                }
              }}
              className="flex w-full justify-center items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
