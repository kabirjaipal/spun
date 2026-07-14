"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Download, Calendar, Eye, EyeOff, Search, RotateCcw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

interface Company {
  companyId: number;
  companyName: string;
  gstNo?: string | null;
  address?: string | null;
  financialYearStart?: string | Date | null;
}

interface LedgerGroup {
  groupId: number;
  groupName: string;
  parentGroupId?: number | null;
}

interface Ledger {
  ledgerId: number;
  ledgerName: string;
  ledgerType: string;
  groupId: number | null;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
}

interface TrialBalanceClientProps {
  company: Company;
  groups: LedgerGroup[];
  ledgers: Ledger[];
  canExport: boolean;
}

interface TreeNode {
  id: string; // "group-{id}" or "ledger-{id}"
  name: string;
  type: "group" | "ledger";
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
  level: number;
  groupId?: number;
  ledgerId?: number;
  children: TreeNode[];
}

function TrialBalanceContent({
  company,
  groups,
  ledgers,
  canExport,
}: TrialBalanceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Period state from URL or defaults
  // Dynamic current FY defaults (April start)
  const fyStartYear = (() => { const m = new Date().getMonth(); const y = new Date().getFullYear(); return m >= 3 ? y : y - 1; })();
  const fromParam = searchParams.get("from") || `${fyStartYear}-04-01`;
  const toParam = searchParams.get("to") || `${fyStartYear + 1}-03-31`;

  const [startDate, setStartDate] = useState(fromParam);
  const [endDate, setEndDate] = useState(toParam);
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Omission lists
  const [removedLines, setRemovedLines] = useState<string[]>([]);
  const [lastRemovedLine, setLastRemovedLine] = useState<string | null>(null);

  const [isDetailed, setIsDetailed] = useState(true);

  // Formatting to Indian Currency (en-IN)
  const formatAmount = (val: number) => {
    if (val === 0) return "—";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(val));
  };

  // Helper to build the hierarchical tree
  const buildTreeData = () => {
    // Filter out ledgers and groups that have been omitted
    const activeLedgers = ledgers.filter(
      (l) => !removedLines.includes(l.ledgerName) && !removedLines.includes(`ledger-${l.ledgerId}`)
    );
    const activeGroups = groups.filter(
      (g) => !removedLines.includes(g.groupName) && !removedLines.includes(`group-${g.groupId}`)
    );

    const allNodesMap = new Map<string, TreeNode>();

    // Initialize group nodes
    const groupNodes: TreeNode[] = activeGroups.map((g) => ({
      id: `group-${g.groupId}`,
      name: g.groupName,
      type: "group",
      openingDebit: 0,
      openingCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
      level: 0,
      groupId: g.groupId,
      children: [],
    }));

    // Initialize ledger nodes with net balances
    const ledgerNodes: TreeNode[] = activeLedgers.map((l) => {
      const opNet = l.openingDebit - l.openingCredit;
      const clNet = (l.openingDebit + l.periodDebit) - (l.openingCredit + l.periodCredit);
      return {
        id: `ledger-${l.ledgerId}`,
        name: l.ledgerName,
        type: "ledger",
        openingDebit: opNet > 0 ? opNet : 0,
        openingCredit: opNet < 0 ? Math.abs(opNet) : 0,
        closingDebit: clNet > 0 ? clNet : 0,
        closingCredit: clNet < 0 ? Math.abs(clNet) : 0,
        level: 0,
        ledgerId: l.ledgerId,
        children: [],
      };
    });

    const groupMap = new Map<number, TreeNode>();
    groupNodes.forEach((node) => {
      groupMap.set(node.groupId!, node);
      allNodesMap.set(node.id, node);
    });
    ledgerNodes.forEach((node) => {
      allNodesMap.set(node.id, node);
    });

    // Roll up ledger balances to all ancestor groups
    activeLedgers.forEach((l, idx) => {
      const node = ledgerNodes[idx];
      const od = node.openingDebit;
      const oc = node.openingCredit;
      const cd = node.closingDebit;
      const cc = node.closingCredit;
      if (od === 0 && oc === 0 && cd === 0 && cc === 0) return;

      let currentGroupId = l.groupId;
      let depth = 0;
      while (currentGroupId && depth < 10) {
        const parentGroup = groupMap.get(currentGroupId);
        if (!parentGroup) break;
        parentGroup.openingDebit += od;
        parentGroup.openingCredit += oc;
        parentGroup.closingDebit += cd;
        parentGroup.closingCredit += cc;
        const groupInfo = activeGroups.find((g) => g.groupId === currentGroupId);
        currentGroupId = groupInfo ? (groupInfo.parentGroupId ?? null) : null;
        depth++;
      }
    });

    const rootNodes: TreeNode[] = [];

    // Parent-child relationships for groups
    activeGroups.forEach((g) => {
      const node = groupMap.get(g.groupId)!;
      if (g.parentGroupId) {
        const parentNode = groupMap.get(g.parentGroupId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Parent-child relationships for ledgers
    activeLedgers.forEach((l, idx) => {
      const node = ledgerNodes[idx];
      if (l.groupId) {
        const parentNode = groupMap.get(l.groupId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    // Filter empty groups and sort nodes
    const cleanAndSort = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          node.children = cleanAndSort(node.children);
          return node;
        })
        .filter((node) => {
          if (node.type === "ledger") {
            return (
              node.openingDebit !== 0 ||
              node.openingCredit !== 0 ||
              node.closingDebit !== 0 ||
              node.closingCredit !== 0
            );
          }
          return (
            node.children.length > 0 ||
            node.openingDebit !== 0 ||
            node.openingCredit !== 0 ||
            node.closingDebit !== 0 ||
            node.closingCredit !== 0
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    const finalizedRoots = cleanAndSort(rootNodes);

    // Apply levels recursively
    const setLevels = (nodes: TreeNode[], level: number) => {
      nodes.forEach((n) => {
        n.level = level;
        setLevels(n.children, level + 1);
      });
    };
    setLevels(finalizedRoots, 0);

    return { finalizedRoots, activeLedgers };
  };

  const { finalizedRoots, activeLedgers } = buildTreeData();

  // Generate flat visible rows list
  const getVisibleRows = () => {
    const rows: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        // Apply search filter if active
        if (searchTerm) {
          const matchSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase());
          const hasMatchingChild = (children: TreeNode[]): boolean => {
            return children.some(
              (c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || hasMatchingChild(c.children)
            );
          };
          const matches = matchSearch || hasMatchingChild(n.children);
          if (!matches) return;
        }

        rows.push(n);

        const isExpanded = searchTerm ? true : isDetailed;
        if (n.type === "group" && isExpanded && n.children.length > 0) {
          traverse(n.children);
        }
      });
    };
    traverse(finalizedRoots);
    return rows;
  };

  const visibleRows = getVisibleRows();

  // Omission handlers
  const handleRemoveRow = (name: string) => {
    setRemovedLines((prev) => [...prev, name]);
    setLastRemovedLine(name);
  };

  const handleRestoreRow = () => {
    if (lastRemovedLine) {
      setRemovedLines((prev) => prev.filter((n) => n !== lastRemovedLine));
      setLastRemovedLine(null);
    } else if (removedLines.length > 0) {
      const copy = [...removedLines];
      const popped = copy.pop();
      setRemovedLines(copy);
      setLastRemovedLine(popped || null);
    }
  };

  const handleRestoreAll = () => {
    setRemovedLines([]);
    setLastRemovedLine(null);
  };

  // Grand totals computation using netted balances
  const grandOpeningDebit = activeLedgers.reduce((sum, l) => {
    const net = l.openingDebit - l.openingCredit;
    return sum + (net > 0 ? net : 0);
  }, 0);

  const grandOpeningCredit = activeLedgers.reduce((sum, l) => {
    const net = l.openingDebit - l.openingCredit;
    return sum + (net < 0 ? Math.abs(net) : 0);
  }, 0);

  const grandClosingDebit = activeLedgers.reduce((sum, l) => {
    const net = (l.openingDebit + l.periodDebit) - (l.openingCredit + l.periodCredit);
    return sum + (net > 0 ? net : 0);
  }, 0);

  const grandClosingCredit = activeLedgers.reduce((sum, l) => {
    const net = (l.openingDebit + l.periodDebit) - (l.openingCredit + l.periodCredit);
    return sum + (net < 0 ? Math.abs(net) : 0);
  }, 0);

  const openingDiff = Math.abs(grandOpeningDebit - grandOpeningCredit);
  const closingDiff = Math.abs(grandClosingDebit - grandClosingCredit);
  const hasOpeningDiff = openingDiff > 0.01;
  const hasClosingDiff = closingDiff > 0.01;
  const hasAnyDiff = hasOpeningDiff || hasClosingDiff;

  // Apply Period to URL params
  const handleApplyPeriod = () => {
    setShowPeriodModal(false);
    router.push(`?from=${startDate}&to=${endDate}`);
  };

  const getIndentationClass = (level: number) => {
    switch (level) {
      case 0: return "pl-2";
      case 1: return "pl-8";
      case 2: return "pl-14";
      case 3: return "pl-20";
      case 4: return "pl-26";
      default: return "pl-32";
    }
  };

  return (
    <div className="space-y-6 select-none relative">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            margin: 0mm;
          }
          body {
            margin: 0mm !important;
          }
          .print-area {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            padding: 1rem !important;
            box-sizing: border-box !important;
          }
        }
      `}} />

      {/* Top Header Controls (Omitted during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Trial Balance</h1>
        </div>

        {/* Buttons / Search panel */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ledger/group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-52 text-sm bg-background border-input"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setIsDetailed(!isDetailed)}
            className="flex items-center gap-2"
          >
            {isDetailed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {isDetailed ? "Condensed" : "Detailed"}
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowPeriodModal(true)}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Period
          </Button>

          <Button
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Main Report Table Grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden print-area shadow-sm">
        {/* Tally-Style Report Title Sheet (Always printed) */}
        <div className="text-center py-6 border-b border-border bg-muted/20">
          <h2 className="text-lg font-extrabold uppercase tracking-widest text-foreground">
            {company.companyName}
          </h2>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground mt-1">
            Trial Balance
          </h1>
          <p className="text-xs text-muted-foreground tracking-wide mt-1">
            {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} to {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Table Header Columns */}
        <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {/* Particulars Title */}
          <div className="col-span-6 p-3.5 border-r border-border pl-4 flex items-center">
            Particulars
          </div>
          {/* Opening Balance Column Group */}
          <div className="col-span-3 border-r border-border flex flex-col text-center">
            <div className="p-2 border-b border-border font-bold">Opening Balance</div>
            <div className="grid grid-cols-2 text-right">
              <div className="p-2 border-r border-border">Debit</div>
              <div className="p-2">Credit</div>
            </div>
          </div>
          {/* Closing Balance Column Group */}
          <div className="col-span-3 flex flex-col text-center">
            <div className="p-2 border-b border-border font-bold">Closing Balance</div>
            <div className="grid grid-cols-2 text-right">
              <div className="p-2 border-r border-border">Debit</div>
              <div className="p-2">Credit</div>
            </div>
          </div>
        </div>

        {/* Dynamic Tree Rows */}
        <div className="divide-y divide-border/40 min-h-[300px] text-sm">
          {visibleRows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No matching records found. Try modifying filters.
            </div>
          ) : (
            visibleRows.map((row) => {
              const isGrp = row.type === "group";

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-12 transition-colors group/row hover:bg-muted/30 text-foreground"
                >
                  {/* Name cell with hierarchy indent */}
                  <div className="col-span-6 p-3 border-r border-border flex items-center justify-between">
                    <div className={`flex items-center select-none ${getIndentationClass(row.level)}`}>
                      {!isGrp ? (
                        <a
                          href={`/dashboard/reports/ledger-report?ledgerId=${row.ledgerId}`}
                          className="italic text-primary hover:underline font-semibold cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </a>
                      ) : (
                        <span className="font-bold text-foreground">
                          {row.name}
                        </span>
                      )}
                    </div>

                    {/* Omit hover control */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRow(row.name);
                      }}
                      className="opacity-0 group-hover/row:opacity-100 transition-opacity text-xs text-destructive hover:underline p-1 ml-2 mr-2 no-print"
                      title="Omit this row"
                    >
                      Omit
                    </button>
                  </div>

                  {/* Opening Balance Columns */}
                  <div className="col-span-3 grid grid-cols-2 text-right font-mono font-medium text-xs border-r border-border">
                    <div className="p-3 border-r border-border flex items-center justify-end pr-3.5 text-foreground/90">
                      {row.openingDebit > 0 ? formatAmount(row.openingDebit) : "—"}
                    </div>
                    <div className="p-3 flex items-center justify-end pr-3.5 text-foreground/90">
                      {row.openingCredit > 0 ? formatAmount(row.openingCredit) : "—"}
                    </div>
                  </div>

                  {/* Closing Balance Columns */}
                  <div className="col-span-3 grid grid-cols-2 text-right font-mono font-medium text-xs">
                    <div className="p-3 border-r border-border flex items-center justify-end pr-3.5 text-foreground/90">
                      {row.closingDebit > 0 ? formatAmount(row.closingDebit) : "—"}
                    </div>
                    <div className="p-3 flex items-center justify-end pr-3.5 text-foreground/90">
                      {row.closingCredit > 0 ? formatAmount(row.closingCredit) : "—"}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Difference in trial balance row (balancing row) */}
          {hasAnyDiff && (
            <div className="grid grid-cols-12 bg-destructive/5 text-sm font-semibold text-destructive">
              <div className="col-span-6 p-3 border-r border-border pl-4 flex items-center justify-between">
                <span>Difference in Opening / Closing Balances</span>
                <span className="text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded font-normal no-print">
                  Unbalanced Books
                </span>
              </div>
              {/* Opening Balance Diff */}
              <div className="col-span-3 grid grid-cols-2 text-right font-mono font-bold text-xs border-r border-border">
                <div className="p-3 border-r border-border pr-3.5">
                  {hasOpeningDiff && grandOpeningDebit < grandOpeningCredit ? formatAmount(openingDiff) : "—"}
                </div>
                <div className="p-3 pr-3.5">
                  {hasOpeningDiff && grandOpeningCredit < grandOpeningDebit ? formatAmount(openingDiff) : "—"}
                </div>
              </div>
              {/* Closing Balance Diff */}
              <div className="col-span-3 grid grid-cols-2 text-right font-mono font-bold text-xs">
                <div className="p-3 border-r border-border pr-3.5">
                  {hasClosingDiff && grandClosingDebit < grandClosingCredit ? formatAmount(closingDiff) : "—"}
                </div>
                <div className="p-3 pr-3.5">
                  {hasClosingDiff && grandClosingCredit < grandClosingDebit ? formatAmount(closingDiff) : "—"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Grand Totals Row */}
        <div className="grid grid-cols-12 border-t-2 border-b-4 border-double border-border bg-muted/20 text-sm font-bold text-foreground">
          <div className="col-span-6 p-3.5 border-r border-border pl-4 uppercase">
            Grand Total
          </div>
          <div className="col-span-3 grid grid-cols-2 text-right font-mono text-xs border-r border-border">
            <div className="p-3.5 border-r border-border pr-3.5 font-extrabold text-foreground">
              {formatAmount(grandOpeningDebit)}
            </div>
            <div className="p-3.5 pr-3.5 font-extrabold text-foreground">
              {formatAmount(grandOpeningCredit)}
            </div>
          </div>
          <div className="col-span-3 grid grid-cols-2 text-right font-mono text-xs">
            <div className="p-3.5 border-r border-border pr-3.5 font-extrabold text-foreground">
              {formatAmount(grandClosingDebit)}
            </div>
            <div className="p-3.5 pr-3.5 font-extrabold text-foreground">
              {formatAmount(grandClosingCredit)}
            </div>
          </div>
        </div>
      </div>

      {/* Omitted Rows Alert Info (Omitted during print) */}
      {removedLines.length > 0 && (
        <div className="mt-4 p-4 bg-secondary border border-border rounded-lg text-xs text-muted-foreground flex justify-between items-center no-print shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary shrink-0" />
            <span>
              Hidden <strong>{removedLines.length}</strong> row(s) from report structure. Grand totals adjusted dynamically.
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="default" variant="outline" className="h-9 px-4" onClick={handleRestoreRow}>
              Restore Last
            </Button>
            <Button
              size="default"
              variant="destructive"
              className="h-9 px-4"
              onClick={handleRestoreAll}
            >
              Restore All
            </Button>
          </div>
        </div>
      )}

      {/* Date Period selector dialog (Omitted during print) */}
      <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Report Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="col-span-3 h-10 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyPeriod}>
              Apply Period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TrialBalanceClient(props: TrialBalanceClientProps) {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /><span>Loading Trial Balance</span></div>}>
      <TrialBalanceContent {...props} />
    </Suspense>
  );
}
