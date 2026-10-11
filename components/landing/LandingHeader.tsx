"use client";

import React, { useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Menu, X } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";

interface LandingHeaderProps {
  isAuthenticated: boolean;
}

export default function LandingHeader({ isAuthenticated }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm shadow-sm">
            {APP_NAME.charAt(0)}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-foreground">
              {APP_NAME}
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs font-semibold text-primary border-primary/30">
              Open Source
            </Badge>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="#features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#textile-ops" className="transition-colors hover:text-foreground">
            Textile Ops
          </Link>
          <Link href="#comparison" className="transition-colors hover:text-foreground">
            Why Spun
          </Link>
          <Link href="#self-host" className="transition-colors hover:text-foreground">
            Self-Hosting
          </Link>
          <Link href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="https://github.com/kabirjaipal/spun"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2">
              <GithubIcon className="h-4 w-4" />
              <span>Star on GitHub</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button className="gap-2">
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button className="gap-2">
                <span>Live Demo</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden">
          <Button
            variant="ghost"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 text-foreground" />}
          </Button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2.5 text-sm font-medium text-foreground">
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary"
            >
              Features
            </Link>
            <Link
              href="#textile-ops"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary"
            >
              Textile Ops
            </Link>
            <Link
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary"
            >
              Why Spun
            </Link>
            <Link
              href="#self-host"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary"
            >
              Self-Hosting
            </Link>
            <Link
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1.5 hover:text-primary"
            >
              FAQ
            </Link>
          </nav>
          <div className="pt-2 border-t border-border flex flex-col gap-2">
            <Link
              href="https://github.com/kabirjaipal/spun"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Button variant="outline" className="w-full gap-2">
                <GithubIcon className="h-4 w-4" />
                <span>GitHub Repository</span>
              </Button>
            </Link>
            <Link
              href={isAuthenticated ? "/dashboard" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Button className="w-full gap-2">
                <span>{isAuthenticated ? "Go to Dashboard" : "Live Demo / Login"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
