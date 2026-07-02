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
  parentCompanyId: bigint("parent_company_id", { mode: "number" }).references((): any => mCompanies.companyId),
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
  companyType: text("company_type").default("general").notNull(),
  marketCategory: text("market_category"),
  msmeRegistered: boolean("msme_registered").default(false).notNull(),
  msmeType: text("msme_type"), // 'micro', 'small', 'medium'
  msmeNo: text("msme_no"), // Udyam Registration Number e.g. UDYAM-GJ-01-0012345
  dueDay: integer("due_day").default(10).notNull(),
  ...auditColumns,
}, (table) => ({
  companyNameIdx: index("idx_m_companies_company_name").on(table.companyName),
  parentCompanyIdIdx: index("idx_m_companies_parent_company_id").on(table.parentCompanyId),
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





export const mTaxRates = pgTable("m_tax_rates", {
  taxRateId: serial("tax_rate_id").primaryKey(),
  taxName: text("tax_name").notNull(),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull(),
  ...auditColumns,
}, (table) => ({
  taxNameIdx: index("idx_m_tax_rates_tax_name").on(table.taxName),
}));

export const mInventoryGroups = pgTable("m_inventory_groups", {
  inventoryGroupId: serial("inventory_group_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  groupName: text("group_name").notNull(), // Consumable or Selling
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_inventory_groups_company_id").on(table.companyId),
}));

export const mInventoryCategories = pgTable("m_inventory_categories", {
  inventoryCategoryId: serial("inventory_category_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  categoryName: text("category_name").notNull(), // Cloth, Color, Chemical, etc.
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_inventory_categories_company_id").on(table.companyId),
}));

export const mUnitsOfMeasurement = pgTable("m_units_of_measurement", {
  unitId: serial("unit_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  unitCode: text("unit_code").notNull(), // MTR, KG, PCS, etc.
  unitName: text("unit_name").notNull(), // Meters, Kilograms, Pieces, etc.
  isFixed: boolean("is_fixed").default(false).notNull(),
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_units_of_measurement_company_id").on(table.companyId),
}));

export const mInventory = pgTable("m_inventory", {
  inventoryId: serial("inventory_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  inventoryCode: text("inventory_code").notNull(),
  inventoryName: text("inventory_name").notNull(),
  unit: text("unit").notNull(),
  gstRateId: bigint("gst_rate_id", { mode: "number" })
    .references(() => mTaxRates.taxRateId),
  openingStockQty: numeric("opening_stock_qty", { precision: 15, scale: 4 }).default("0.0000").notNull(),
  openingStockRate: numeric("opening_stock_rate", { precision: 15, scale: 2 }).default("0.00").notNull(),
  
  hsnCode: text("hsn_code"),
  inventoryGroupId: bigint("inventory_group_id", { mode: "number" })
    .references(() => mInventoryGroups.inventoryGroupId),
  inventoryCategoryId: bigint("inventory_category_id", { mode: "number" })
    .references(() => mInventoryCategories.inventoryCategoryId),
  gstType: text("gst_type"), // 'state', 'center'
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }),
  isConsumable: boolean("is_consumable").default(false).notNull(),
  consumeWithInventoryId: integer("consume_with_inventory_id"), // self reference ID
  consumptionRatio: numeric("consumption_ratio", { precision: 15, scale: 4 }),
  shortagePercent: numeric("shortage_percent", { precision: 5, scale: 2 }),
  formula: text("formula"),

  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_inventory_company_id").on(table.companyId),
  gstRateIdIdx: index("idx_m_inventory_gst_rate_id").on(table.gstRateId),
}));

export const mBrokersHaste = pgTable("m_brokers_haste", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'broker' | 'haste'
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_brokers_haste_company_id").on(table.companyId),
  typeIdx: index("idx_m_brokers_haste_type").on(table.type),
}));

export const mVoucherSequences = pgTable("m_voucher_sequences", {
  sequenceId: serial("sequence_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  voucherType: text("voucher_type").notNull(),
  prefix: text("prefix").notNull(),
  nextNumber: integer("next_number").default(1).notNull(),
  ...auditColumns,
}, (table) => ({
  companyVoucherTypeIdx: index("idx_m_voucher_sequences_company_type").on(table.companyId, table.voucherType),
}));


export const mJobs = pgTable("m_jobs", {
  jobId: serial("job_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  jobName: text("job_name").notNull(),
  address: text("address"),
  gstNo: text("gst_no"),
  gstType: text("gst_type"), // 'regular', 'composition', 'unregistered'
  city: text("city"),
  stateCode: text("state_code"),
  phone: text("phone"),
  msmeRegistered: boolean("msme_registered").default(false).notNull(),
  msmeType: text("msme_type"), // 'micro', 'small', 'medium', 'non_registered'
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_jobs_company_id").on(table.companyId),
}));

export const mMills = pgTable("m_mills", {
  millId: serial("mill_id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" })
    .references(() => mCompanies.companyId)
    .notNull(),
  millName: text("mill_name").notNull(),
  address: text("address"),
  gstNo: text("gst_no"),
  gstType: text("gst_type"), // 'regular', 'composition', 'unregistered'
  city: text("city"),
  stateCode: text("state_code"),
  phone: text("phone"),
  msmeRegistered: boolean("msme_registered").default(false).notNull(),
  msmeType: text("msme_type"), // 'micro', 'small', 'medium', 'non_registered'
  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_m_mills_company_id").on(table.companyId),
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
  ledgerType: text("ledger_type").notNull(), // e.g., 'cash', 'bank', 'customer', 'company', etc.
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
  voucherType: text("voucher_type").notNull(), // 'sale', 'purchase', 'receipt', 'payment', 'journal', 'job_outward', 'job_inward', 'mill_outward', 'mill_inward', 'credit_note', 'debit_note'
  voucherDate: date("voucher_date").notNull(),
  partyId: bigint("party_id", { mode: "number" }),
  remarks: text("remarks"),
  status: text("status").default("draft").notNull(), // 'draft', 'posted', 'cancelled'
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }).default("0.00").notNull(),
  
  // Textile fields
  broker: text("broker"),
  haste: text("haste"),
  lrNo: text("lr_no"),
  lrDate: date("lr_date"),
  transport: text("transport"),
  vehicleNo: text("vehicle_no"),
  personName: text("person_name"),
  lotNo: text("lot_no"),
  invoiceNo: text("invoice_no"),
  invoiceDate: date("invoice_date"),
  goodsName: text("goods_name"),
  printRate: boolean("print_rate").default(true).notNull(),
  printAmount: boolean("print_amount").default(true).notNull(),
  parentVoucherId: bigint("parent_voucher_id", { mode: "number" }),
  cashBankLedgerId: bigint("cash_bank_ledger_id", { mode: "number" }).references(() => mLedgers.ledgerId),
  billDetails: jsonb("bill_details"),
  discountType: text("discount_type"), // 'percentage' or 'value'
  discountValue: numeric("discount_value", { precision: 15, scale: 2 }),
  discountType2: text("discount_type_2"), // 'percentage' or 'value'
  discountValue2: numeric("discount_value_2", { precision: 15, scale: 2 }),

  ...auditColumns,
}, (table) => ({
  companyIdIdx: index("idx_t_vouchers_company_id").on(table.companyId),
  voucherTypeIdx: index("idx_t_vouchers_voucher_type").on(table.voucherType),
}));

export const tVoucherItems = pgTable("t_voucher_items", {
  voucherItemId: serial("voucher_item_id").primaryKey(),
  voucherId: bigint("voucher_id", { mode: "number" })
    .references(() => tVouchers.voucherId)
    .notNull(),
  inventoryId: bigint("inventory_id", { mode: "number" })
    .references(() => mInventory.inventoryId)
    .notNull(),
  hsnCode: text("hsn_code"),
  pcs: integer("pcs").default(0).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 4 }).default("0.0000").notNull(), // meters or main quantity
  fold: numeric("fold", { precision: 5, scale: 2 }).default("100.00").notNull(), // fold percentage
  rate: numeric("rate", { precision: 15, scale: 2 }).notNull(),
  gstRateId: bigint("gst_rate_id", { mode: "number" }).references(() => mTaxRates.taxRateId),
  taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).notNull(),
  cgst: numeric("cgst", { precision: 15, scale: 2 }).default("0.00").notNull(),
  sgst: numeric("sgst", { precision: 15, scale: 2 }).default("0.00").notNull(),
  igst: numeric("igst", { precision: 15, scale: 2 }).default("0.00").notNull(),
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }).notNull(),

  // Job / Mill specific columns
  jobType: text("job_type"),
  jobRateType: text("job_rate_type"), // 'pcs', 'mtr'
  pieceMeters: text("piece_meters"),

  ...auditColumns,
}, (table) => ({
  voucherIdIdx: index("idx_t_voucher_items_voucher_id").on(table.voucherId),
  inventoryIdIdx: index("idx_t_voucher_items_inventory_id").on(table.inventoryId),
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
  inventoryId: bigint("inventory_id", { mode: "number" })
    .references(() => mInventory.inventoryId)
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
  inventoryIdIdx: index("idx_t_stock_movements_inventory_id").on(table.inventoryId),
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


