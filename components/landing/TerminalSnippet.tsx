"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TerminalSnippet() {
  const [copied, setCopied] = useState(false);
  const command = "git clone https://github.com/kabirjaipal/spun.git && cd spun && docker compose up -d";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-4 shadow-lg transition-all hover:border-primary/50">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-danger/80" />
          <div className="h-3 w-3 rounded-full bg-warning/80" />
          <div className="h-3 w-3 rounded-full bg-success/80" />
          <span className="ml-2 flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> bash — Quick Self-Host
          </span>
        </div>
        <Button
          variant="outline"
          onClick={handleCopy}
          className="h-8 px-2.5 text-xs gap-1.5"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success" />
              <span className="text-success font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-sm overflow-x-auto py-1">
        <span className="text-primary font-bold select-none">$</span>
        <span className="text-foreground whitespace-nowrap">{command}</span>
      </div>
    </div>
  );
}
