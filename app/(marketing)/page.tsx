import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LandingHeader from "@/components/landing/LandingHeader";
import TerminalSnippet from "@/components/landing/TerminalSnippet";
import DashboardPreview from "@/components/landing/DashboardPreview";
import LandingFaq from "@/components/landing/LandingFaq";
import { GithubIcon } from "@/components/icons/GithubIcon";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  FileSpreadsheet,
  Layers,
  Lock,
  Receipt,
  Server,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  const isAuthenticated = !!session?.user?.id;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <LandingHeader isAuthenticated={isAuthenticated} />

      <main className="flex-1">
        {/* ================================================================= */}
        {/* Hero Section */}
        {/* ================================================================= */}
        <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center text-center">
              {/* Announcement Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-6">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-foreground">100% Free & Open Source</span>
                <span className="text-border">|</span>
                <span>MIT Licensed Textile ERP</span>
              </div>

              {/* Main Heading */}
              <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
                Modern Accounting & ERP Built for{" "}
                <span className="text-primary underline decoration-primary/30 decoration-wavy underline-offset-8">
                  Textile Businesses
                </span>
              </h1>

              {/* Subheading */}
              <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                Tally-familiar double-entry speed meets a modern web interface.
                Track mill inward/outward lots, job work dyeing, broker haste commissions,
                and real-time GST statements with complete self-hosted data ownership.
              </p>

              {/* Primary Call to Actions */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                  <Button className="h-10 px-6 text-sm font-semibold gap-2 shadow-sm">
                    <span>{isAuthenticated ? "Go to Dashboard" : "Explore Live Demo"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Link href="#self-host">
                  <Button variant="outline" className="h-10 px-6 text-sm font-semibold gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <span>Self-Host Guide</span>
                  </Button>
                </Link>

                <Link
                  href="https://github.com/kabirjaipal/spun"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="h-10 px-5 text-sm font-semibold gap-2">
                    <GithubIcon className="h-4 w-4" />
                    <span>Star on GitHub</span>
                  </Button>
                </Link>
              </div>

              {/* Docker Quickstart Snippet */}
              <div className="mt-10 w-full flex justify-center">
                <TerminalSnippet />
              </div>

              {/* Live Interactive Dashboard / Voucher Preview */}
              <div className="mt-14 w-full flex justify-center">
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* Why Spun / Comparison Section */}
        {/* ================================================================= */}
        <section id="comparison" className="border-t border-border bg-card/60 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-primary border-primary/30 mb-3">
                Why Textile Businesses Choose Spun
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                The Best of Desktop Accounting & Modern Cloud
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Desktop tools lack remote collaboration and modern UX. Commercial SaaS locks your financial data into recurring fees. Spun provides the optimal middle ground.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Traditional Desktop ERPs */}
              <div className="rounded-xl border border-border bg-background p-6 space-y-4">
                <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                  <div className="h-2 w-2 rounded-full bg-danger" />
                  <span>Legacy Desktop ERP (Tally)</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">Fast, but Trapped Locally</h3>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-danger font-bold">✕</span> Tied to a specific Windows PC or local LAN
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-danger font-bold">✕</span> Clunky, dated interface with steep learning curves
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-danger font-bold">✕</span> No native textile mill & lot inward/outward workflows
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-danger font-bold">✕</span> Hard to grant granular, secure mobile/remote access
                  </li>
                </ul>
              </div>

              {/* Generic Cloud SaaS */}
              <div className="rounded-xl border border-border bg-background p-6 space-y-4">
                <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span>Generic Cloud SaaS</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">Accessible, but Mismatched</h3>
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-warning font-bold">✕</span> Expensive recurring monthly per-user subscriptions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning font-bold">✕</span> Destroys standard double-entry mental models
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning font-bold">✕</span> Zero understanding of weaving, gray cloth, and mills
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-warning font-bold">✕</span> Your confidential company ledger sits in closed clouds
                  </li>
                </ul>
              </div>

              {/* Spun (TextileERP) */}
              <div className="rounded-xl border-2 border-primary bg-card p-6 space-y-4 relative shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Spun (Self-Hosted)</span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold text-primary">
                    Open Source
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-foreground">Tailored for Textile Leaders</h3>
                <ul className="space-y-2.5 text-xs text-foreground font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span>Tally-familiar double-entry ledger & voucher engine</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span>Native Mill Inward/Outward & Job Work Lot tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span>100% self-hosted on your own server or Docker</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <span>Zero subscription fees, unlimited users & companies</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* Core Modules Grid */}
        {/* ================================================================= */}
        <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-primary border-primary/30 mb-3">
                Comprehensive Accounting Architecture
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything Needed to Run Textile Operations
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                From purchasing raw yarn to shipping finished fabrics and filing monthly GST returns.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1: Voucher Engine */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Full Tally Voucher Suite</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Support for Sales, Purchases, Sales Return, Purchase Return, Direct Bills, Receipts, Payments, Credit Notes, Debit Notes, and Journal entries with auto-balancing validations.
                </p>
              </div>

              {/* Feature 2: Textile Operations */}
              <div id="textile-ops" className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Mill Inward & Job Work</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Track fabric lots dispatched to mills for bleaching, dyeing, and printing. Monitor exact inward deliveries, process shrinkage, and warehouse lot transfers.
                </p>
              </div>

              {/* Feature 3: Real-Time Reports */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Real-Time Financial Reports</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instant Day Book, party-wise Ledger Statements, Group Outstandings (Sundry Debtors / Creditors), and Cash & Bank flow statements updated on every transaction.
                </p>
              </div>

              {/* Feature 4: Granular RBAC */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Granular Role Permissions</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Precise Create, Read, Update, Delete, Export, and Approve controls for Owners, Accountants, Dispatchers, and Sales Agents with automatic `/access-denied` guards.
                </p>
              </div>

              {/* Feature 5: GST & Masters */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">GST & Haste Brokerage</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Indian GST rates (CGST, SGST, IGST) with state codes and optional automated GSTIN autofill. Dedicated broker / haste tracking for textile agency commissions.
                </p>
              </div>

              {/* Feature 6: Multi-Company Architecture */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-3 transition-all hover:border-primary/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">Multi-Company Management</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Switch instantly between trading entities, weaving plants, and processing units with isolated chart of accounts and customized fiscal year configurations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* Self-Hosting Guide Section */}
        {/* ================================================================= */}
        <section id="self-host" className="border-t border-border bg-card/60 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-primary border-primary/30 mb-3">
                Zero Cloud Vendor Lock-In
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Self-Host in 3 Simple Steps
              </h2>
              <p className="mt-4 text-muted-foreground text-sm sm:text-base">
                Spin up Spun on your own server, local office network, or cloud VPS with Docker Compose.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="rounded-xl border border-border bg-background p-6 space-y-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  1
                </div>
                <h3 className="text-base font-bold text-foreground">Clone & Configure</h3>
                <p className="text-xs text-muted-foreground">
                  Clone the repository and copy the environment template:
                </p>
                <div className="rounded-lg bg-muted p-2 font-mono text-xs text-foreground overflow-x-auto">
                  <code>cp .env.example .env</code>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-6 space-y-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  2
                </div>
                <h3 className="text-base font-bold text-foreground">Launch Containers</h3>
                <p className="text-xs text-muted-foreground">
                  Start PostgreSQL and the Next.js server with one command:
                </p>
                <div className="rounded-lg bg-muted p-2 font-mono text-xs text-foreground overflow-x-auto">
                  <code>docker compose up -d</code>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-6 space-y-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  3
                </div>
                <h3 className="text-base font-bold text-foreground">Run Migrations & Seed</h3>
                <p className="text-xs text-muted-foreground">
                  Execute schema setup and populate realistic mock data:
                </p>
                <div className="rounded-lg bg-muted p-2 font-mono text-xs text-foreground overflow-x-auto">
                  <code>npm run db:realseed</code>
                </div>
              </div>
            </div>

            {/* Test Credentials Table */}
            <div className="mt-12 mx-auto max-w-2xl rounded-xl border border-border bg-background p-6">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Pre-configured Demo Credentials
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                When you run the seed script, you can immediately log into the live platform using:
              </p>
              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-border p-3 bg-card">
                  <p className="font-semibold text-foreground">Spun Trading Co. (Full ERP)</p>
                  <p className="mt-1 text-muted-foreground font-mono">test@spun.app</p>
                  <p className="text-muted-foreground font-mono">password123</p>
                </div>
                <div className="rounded-lg border border-border p-3 bg-card">
                  <p className="font-semibold text-foreground">System Owner (Multi-Company)</p>
                  <p className="mt-1 text-muted-foreground font-mono">owner@spun.app</p>
                  <p className="text-muted-foreground font-mono">password123</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* Technology Stack Banner */}
        {/* ================================================================= */}
        <section className="px-4 py-16 sm:px-6 lg:px-8 border-t border-border">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-8">
              <h3 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                Engineered with Modern, Production-Tested Open Source Tech
              </h3>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-muted-foreground font-medium text-xs sm:text-sm">
              <span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> Next.js 16 App Router</span>
              <span className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> PostgreSQL & Drizzle ORM</span>
              <span className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Docker & Compose</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Auth.js v5 (NextAuth)</span>
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Tailwind CSS v4 & shadcn/ui</span>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* Frequently Asked Questions */}
        {/* ================================================================= */}
        <section id="faq" className="border-t border-border bg-card/40 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-primary border-primary/30 mb-3">
                Got Questions?
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Frequently Asked Questions
              </h2>
            </div>

            <LandingFaq />
          </div>
        </section>

        {/* ================================================================= */}
        {/* Bottom Call to Action */}
        {/* ================================================================= */}
        <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8 bg-card">
          <div className="mx-auto max-w-4xl text-center space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Take Full Control of Your Textile Accounting Today
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground text-sm sm:text-base">
              No subscription fees. No arbitrary limits. Download the code, customize it for your business, and host it anywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                <Button className="h-10 px-6 text-sm font-semibold gap-2 shadow-sm">
                  <span>{isAuthenticated ? "Launch Dashboard" : "Open Live Demo"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                href="https://github.com/kabirjaipal/spun"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="h-10 px-6 text-sm font-semibold gap-2">
                  <GithubIcon className="h-4 w-4" />
                  <span>View GitHub Repository</span>
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-10 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground font-black text-xs">
              {APP_NAME.charAt(0)}
            </div>
            <span className="font-bold text-foreground">{APP_NAME}</span>
            <span>— Open-Source Textile ERP. Licensed under MIT.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="#self-host" className="hover:text-foreground">
              Self-Host
            </Link>
            <Link
              href="https://github.com/kabirjaipal/spun/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Contributing
            </Link>
            <Link
              href="https://github.com/kabirjaipal/spun"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
