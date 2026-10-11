"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question: "Is Spun completely free and open source?",
    answer:
      "Yes. Spun is released under the permissive MIT License. You have complete freedom to download, run, modify, and self-host Spun on your own infrastructure with no user limits or subscription costs.",
  },
  {
    question: "Can Spun replace Tally for my textile business?",
    answer:
      "Spun is purpose-built to preserve the core accounting principles that make Tally fast and reliable (double-entry bookkeeping, debit/credit journal vouchers, party accounts, and ledger groups) while introducing modern web navigation, multi-company access, and role-based permissions.",
  },
  {
    question: "How do I self-host Spun on my own server?",
    answer:
      "You can launch Spun in seconds using Docker Compose (`docker compose up -d`). It runs with an isolated PostgreSQL database container. You can host it on Linode, Hetzner, AWS, a factory local server, or even on a local intranet without external internet access.",
  },
  {
    question: "Does Spun support textile-specific processes?",
    answer:
      "Yes. Unlike generic accounting software, Spun features dedicated modules for Mill Inward, Mill Outward, Job Inward, Job Outward, Lot Transfers, Broker/Haste commissions, and gray vs finished cloth stock tracking.",
  },
  {
    question: "How does Spun handle data security and backups?",
    answer:
      "Since Spun is self-hosted, your financial and operational data lives exclusively on your own PostgreSQL database. No third party has access to your accounts, customer lists, or turnover data. You can back up your database using standard PostgreSQL tools like `pg_dump`.",
  },
  {
    question: "Can I manage multiple companies and branches?",
    answer:
      "Yes. Spun has native multi-company architecture. You can switch between sister concerns, weaving mills, or trading entities from a single unified account.",
  },
];

export default function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="mx-auto max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
      {FAQS.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="p-5 sm:p-6 transition-colors">
            <button
              onClick={() => toggle(idx)}
              className="flex w-full items-center justify-between text-left text-base font-semibold text-foreground"
              aria-expanded={isOpen}
            >
              <span>{faq.question}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180 text-primary"
                )}
              />
            </button>
            {isOpen && (
              <div className="mt-3 text-sm text-muted-foreground leading-relaxed animate-in fade-in">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
