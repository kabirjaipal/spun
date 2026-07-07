import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type Role = "owner" | "company";

export interface PageConfig {
  accessItem: string;
  pageUrl: string;
  pageTitle: string;
  pageIcon: string;
  pageGroup: string;
  accessGroup: "company" | "owner";
}

export const ALL_PAGES: PageConfig[] = [
  // Masters
  { accessItem: "parties", pageUrl: "/dashboard/parties", pageTitle: "Parties", pageIcon: "Building", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "inventory", pageUrl: "/dashboard/inventory", pageTitle: "Inventory", pageIcon: "Package", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "inventory_categories", pageUrl: "/dashboard/inventory", pageTitle: "Inventory Categories", pageIcon: "Layers", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "inventory_groups", pageUrl: "/dashboard/inventory", pageTitle: "Inventory Groups", pageIcon: "Folder", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "units_of_measurement", pageUrl: "/dashboard/inventory", pageTitle: "Units of Measurement", pageIcon: "Scale", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "jobs", pageUrl: "/dashboard/jobs", pageTitle: "Job Master", pageIcon: "Briefcase", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "mills", pageUrl: "/dashboard/mills", pageTitle: "Mill Master", pageIcon: "Building", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "ledgers", pageUrl: "/dashboard/ledgers", pageTitle: "Ledgers", pageIcon: "BookOpen", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "ledger_groups", pageUrl: "/dashboard/ledger-groups", pageTitle: "Ledger Groups", pageIcon: "FolderTree", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "gateway", pageUrl: "/dashboard/gateway", pageTitle: "Gateway", pageIcon: "LayoutGrid", pageGroup: "Masters", accessGroup: "company" },
  { accessItem: "tax_rates", pageUrl: "/dashboard/tax-rates", pageTitle: "Tax Rates", pageIcon: "Percent", pageGroup: "Masters", accessGroup: "company" },
  
  // Transactions
  { accessItem: "sales", pageUrl: "/dashboard/sales", pageTitle: "Sales", pageIcon: "FileSpreadsheet", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "purchase", pageUrl: "/dashboard/purchase", pageTitle: "Purchase", pageIcon: "ShoppingCart", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "purchase_return", pageUrl: "/dashboard/purchase-return", pageTitle: "Purchase Return", pageIcon: "ShoppingBag", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "sales_return", pageUrl: "/dashboard/sales-return", pageTitle: "Sales Return", pageIcon: "ShoppingBag", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "job_outward", pageUrl: "/dashboard/job-outward", pageTitle: "Job Outward", pageIcon: "ArrowUpRight", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "job_inward", pageUrl: "/dashboard/job-inward", pageTitle: "Job Inward", pageIcon: "ArrowDownLeft", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "mill_outward", pageUrl: "/dashboard/mill-outward", pageTitle: "Mill Outward", pageIcon: "ArrowUpRight", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "mill_inward", pageUrl: "/dashboard/mill-inward", pageTitle: "Mill Inward", pageIcon: "ArrowDownLeft", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "receipt", pageUrl: "/dashboard/receipt", pageTitle: "Receipts", pageIcon: "ArrowDownLeft", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "payment", pageUrl: "/dashboard/payment", pageTitle: "Payments", pageIcon: "ArrowUpRight", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "general_entry", pageUrl: "/dashboard/journal-entry", pageTitle: "Journal Entry", pageIcon: "Notebook", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "direct_bill", pageUrl: "/dashboard/direct-bill", pageTitle: "Direct Bill", pageIcon: "FileText", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "credit_note", pageUrl: "/dashboard/credit-note", pageTitle: "Credit Notes", pageIcon: "FileMinus", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "debit_note", pageUrl: "/dashboard/debit-note", pageTitle: "Debit Notes", pageIcon: "FilePlus", pageGroup: "Transactions", accessGroup: "company" },
  { accessItem: "lot_transfer", pageUrl: "/dashboard/lot-transfer", pageTitle: "Lot Transfer", pageIcon: "ArrowLeftRight", pageGroup: "Transactions", accessGroup: "company" },
  
  // Reports
  { accessItem: "ledger_report", pageUrl: "/dashboard/ledger-report", pageTitle: "Ledger Report", pageIcon: "FileText", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "cash_bank_summary", pageUrl: "/dashboard/cash-bank-summary", pageTitle: "Cash/Bank Summary", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "cash_flow_summary", pageUrl: "/dashboard/cash-flow-summary", pageTitle: "Cash Flow Summary", pageIcon: "TrendingUp", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "debit_note_register", pageUrl: "/dashboard/debit-note-register", pageTitle: "Debit Note Register", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "journal_register", pageUrl: "/dashboard/journal-register", pageTitle: "Journal Register", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "group_outstandings", pageUrl: "/dashboard/group-outstandings", pageTitle: "Group Outstandings", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "funds_flow_summary", pageUrl: "/dashboard/funds-flow", pageTitle: "Funds Flow", pageIcon: "TrendingUp", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "group_summary", pageUrl: "/dashboard/group-summary", pageTitle: "Group Summary", pageIcon: "FolderTree", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "group_vouchers", pageUrl: "/dashboard/group-vouchers", pageTitle: "Group Vouchers", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "trial_balance", pageUrl: "/dashboard/trial-balance", pageTitle: "Trial Balance", pageIcon: "Scale", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "profit_loss", pageUrl: "/dashboard/profit-loss", pageTitle: "Profit & Loss", pageIcon: "TrendingUp", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "balance_sheet", pageUrl: "/dashboard/balance-sheet", pageTitle: "Balance Sheet", pageIcon: "Calculator", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "gst_reports", pageUrl: "/dashboard/gst", pageTitle: "GST Reports", pageIcon: "DollarSign", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "day_book", pageUrl: "/dashboard/day-book", pageTitle: "Day Book", pageIcon: "BookOpen", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "stock_summary", pageUrl: "/dashboard/stock-summary", pageTitle: "Stock Summary", pageIcon: "Layers", pageGroup: "Reports", accessGroup: "company" },
  { accessItem: "stock_movements", pageUrl: "/dashboard/stock-movements", pageTitle: "Stock Movements", pageIcon: "Activity", pageGroup: "Reports", accessGroup: "company" },
  
  // Administration
  { accessItem: "users", pageUrl: "/dashboard/users", pageTitle: "Users List", pageIcon: "UserCheck", pageGroup: "Administration", accessGroup: "owner" },
  { accessItem: "roles", pageUrl: "/dashboard/roles", pageTitle: "Roles & Access", pageIcon: "ShieldAlert", pageGroup: "Administration", accessGroup: "owner" },
  { accessItem: "company_settings", pageUrl: "/dashboard/settings", pageTitle: "Company Settings", pageIcon: "Settings", pageGroup: "Administration", accessGroup: "company" }
];

export interface UserPermission {
  accessItem: string;
  pageUrl: string;
  pageTitle: string;
  pageIcon: string;
  pageGroup: string;
  accessGroup: "company" | "owner";
  c: boolean;
  r: boolean;
  u: boolean;
  d: boolean;
  e: boolean;
  a: boolean;
}

export function getStaticPermissionsForRole(role: Role): UserPermission[] {
  const permissions: UserPermission[] = [];

  for (const page of ALL_PAGES) {
    let c = false, r = false, u = false, d = false, e = false, a = false;

    if (role === "owner") {
      if (page.accessGroup === "owner") {
        c = r = u = d = e = a = true;
      }
    } else if (role === "company") {
      if (page.accessGroup === "company") {
        if (page.accessItem === "company_settings") {
          r = u = true; // Can read and edit company settings
        } else if (page.pageGroup !== "Administration") {
          r = true; // Can read Masters, Transactions, Inventory, Reports
          e = true; // Can export reports/masters
          if (page.pageGroup === "Masters" || page.pageGroup === "Transactions") {
            c = u = true; // Can create and update reference data and vouchers
          }
        }
      }
    }

    if (r) {
      permissions.push({
        ...page,
        c, r, u, d, e, a
      });
    }
  }

  return permissions;
}

export async function getUserPagePermissions(userId: string): Promise<UserPermission[]> {
  const user = await db.query.mUsers.findFirst({
    where: eq(mUsers.id, userId),
  });
  if (!user || !user.role) return [];

  const permissions = getStaticPermissionsForRole(user.role as Role);

  // If user has no company associated, they only see pages in the "owner" accessGroup
  if (!user.companyId) {
    return permissions.filter((p) => p.accessGroup === "owner");
  }

  return permissions;
}
