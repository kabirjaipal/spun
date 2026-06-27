import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  bigint,
  boolean,
  numeric,
  date,
  jsonb,
  serial,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

// Helper for repeating audit columns
const auditColumns = {
  createdOn: timestamp("created_on", { mode: "date" }).defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedOn: timestamp("updated_on", { mode: "date" }).defaultNow().notNull(),
  updatedBy: text("updated_by"),
  deletedOn: timestamp("deleted_on", { mode: "date" }),
  deletedBy: text("deleted_by"),
};

// -------------------------------------------------------------
// 1. NextAuth / Core Admin Tables (Prefix: m_ or p_)
// -------------------------------------------------------------

export const mCompanies = pgTable("m_companies", {
  companyId: serial("company_id").primaryKey(),
  companyName: text("company_name").notNull(),
  gstNo: text("gst_no"),
  panNo: text("pan_no"),
  address: text("address"),
  pincode: text("pincode"),
  state: text("state"),
  phone: text("phone"),
  email: text("email"),
  currencySymbol: text("currency_symbol"),
  nationName: text("nation_name"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  accountNo: text("account_no"),
  ifscCode: text("ifsc_code"),
  branchName: text("branch_name"),
  accountType: text("account_type"), // 'saving', 'current', 'cc', 'od', 'other'
  gstApplicable: boolean("gst_applicable").default(false).notNull(),
  gstType: text("gst_type"), // 'regular', 'composition', 'export'
  stateCode: text("state_code"),
  city: text("city"),
  financialYearStart: date("financial_year_start"),
  ...auditColumns,
}, (table) => ({
  companyNameIdx: index("idx_m_companies_company_name").on(table.companyName),
}));

export const mUsers = pgTable("m_users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").default(true).notNull(),
  role: text("role").default("company").notNull(),
  companyId: bigint("company_id", { mode: "number" }).references(() => mCompanies.companyId),
  ...auditColumns,
});

export const pAccounts = pgTable("p_accounts", {
  userId: text("userId")
    .notNull()
    .references(() => mUsers.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.provider, table.providerAccountId] }),
}));

export const pSessions = pgTable("p_sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => mUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const pVerificationTokens = pgTable("p_verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.identifier, table.token] }),
}));

// -------------------------------------------------------------
// 2. Business Masters (Prefix: m_)
// -------------------------------------------------------------

export const mCustomers = pgTable("m_customers", {
  customerId: serial("customer_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  customerName: text("customer_name").notNull(),
  gstNo: text("gst_no"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_customers_company_id").on(table.companyId),
}));

export const mSuppliers = pgTable("m_suppliers", {
  supplierId: serial("supplier_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  supplierName: text("supplier_name").notNull(),
  gstNo: text("gst_no"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_suppliers_company_id").on(table.companyId),
}));

export const mTaxRates = pgTable("m_tax_rates", {
  taxRateId: serial("tax_rate_id").primaryKey(),
  taxName: text("tax_name").notNull(),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull(),
  ...auditColumns,
}, (table) => ({
  taxNameIdx: index("idx_m_tax_rates_tax_name").on(table.taxName),
}));

export const mProducts = pgTable("m_products", {
  productId: serial("product_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  unit: text("unit").notNull(),
  gstRateId: bigint("gst_rate_id", { mode: "number" })
    .references(() => mTaxRates.taxRateId),
  openingStockQty: numeric("opening_stock_qty", { precision: 15, scale: 4 }).default("0.0000").notNull(),
  openingStockRate: numeric("opening_stock_rate", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_products_company_id").on(table.companyId),
  gstRateIdIdx: index("idx_m_products_gst_rate_id").on(table.gstRateId),
}));

export const mLedgerGroups = pgTable("m_ledger_groups", {
  groupId: serial("group_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  groupName: text("group_name").notNull(),
  parentGroupId: integer("parent_group_id"),
  isSystem: boolean("is_system").default(false).notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_ledger_groups_company_id").on(table.companyId),
}));

export const mLedgers = pgTable("m_ledgers", {
  ledgerId: serial("ledger_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  ledgerName: text("ledger_name").notNull(),
  shortName: text("short_name"),
  address: text("address"),
  groupId: bigint("group_id", { mode: "number" })
    .references(() => mLedgerGroups.groupId),
  gstNo: text("gst_no"),
  msmeType: text("msme_type"), // 'registered_micro', 'registered_small', 'registered_medium', 'unregistered'
  panNo: text("pan_no"),
  isTdsApplicable: boolean("is_tds_applicable").default(false).notNull(),
  tdsRate: numeric("tds_rate", { precision: 5, scale: 2 }).default("0.00").notNull(),
  creditDays: integer("credit_days").default(0).notNull(),
  rateOfInterest: numeric("rate_of_interest", { precision: 5, scale: 2 }).default("0.00").notNull(),
  ledgerType: text("ledger_type").notNull(), // e.g., 'cash', 'bank', 'customer', 'supplier', etc.
  referenceId: bigint("reference_id", { mode: "number" }),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_ledgers_company_id").on(table.companyId),
  referenceTypeIdx: index("idx_m_ledgers_reference_id_type").on(table.referenceId, table.ledgerType),
}));

// -------------------------------------------------------------
// 3. Transactions (Prefix: t_)
// -------------------------------------------------------------

export const tVouchers = pgTable("t_vouchers", {
  voucherId: serial("voucher_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  voucherNo: text("voucher_no").notNull(),
  voucherType: text("voucher_type").notNull(), // 'sale', 'purchase', 'receipt', 'payment', 'journal'
  voucherDate: date("voucher_date").notNull(),
  partyId: bigint("party_id", { mode: "number" }),
  remarks: text("remarks"),
  status: text("status").default("draft").notNull(), // 'draft', 'posted', 'cancelled'
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_t_vouchers_company_id").on(table.companyId),
  voucherTypeIdx: index("idx_t_vouchers_voucher_type").on(table.voucherType),
}));

export const tVoucherEntries = pgTable("t_voucher_entries", {
  voucherEntryId: serial("voucher_entry_id").primaryKey(),
  voucherId: bigint("voucher_id", { mode: "number" })
    .references(() => tVouchers.voucherId)
    .notNull(),
  ledgerId: bigint("ledger_id", { mode: "number" })
    .references(() => mLedgers.ledgerId)
    .notNull(),
  entryType: text("entry_type").notNull(), // 'debit', 'credit'
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  ...auditColumns,
}, (table) => ({
  voucherIdIdx: index("idx_t_voucher_entries_voucher_id").on(table.voucherId),
  ledgerIdIdx: index("idx_t_voucher_entries_ledger_id").on(table.ledgerId),
}));

export const tStockMovements = pgTable("t_stock_movements", {
  stockMovementId: serial("stock_movement_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  productId: bigint("product_id", { mode: "number" })
    .references(() => mProducts.productId)
    .notNull(),
  voucherId: bigint("voucher_id", { mode: "number" })
    .references(() => tVouchers.voucherId),
  movementType: text("movement_type").notNull(), // 'purchase', 'sale', 'adjustment', 'opening'
  quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_t_stock_movements_company_id").on(table.companyId),
  productIdIdx: index("idx_t_stock_movements_product_id").on(table.productId),
}));

export const tAuditLogs = pgTable("t_audit_logs", {
  auditLogId: serial("audit_log_id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: bigint("record_id", { mode: "number" }).notNull(),
  actionType: text("action_type").notNull(), // 'create', 'update', 'delete', 'approve'
  oldDataJson: jsonb("old_data_json"),
  newDataJson: jsonb("new_data_json"),
  createdOn: timestamp("created_on", { mode: "date" }).defaultNow().notNull(),
  createdBy: text("created_by"),
}, (table) => ({
  tableNameIdx: index("idx_t_audit_logs_table_name").on(table.tableName),
  actionTypeIdx: index("idx_t_audit_logs_action_type").on(table.actionType),
}));


