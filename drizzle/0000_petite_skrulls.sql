CREATE TABLE "m_companies" (
	"company_id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"gst_no" text,
	"pan_no" text,
	"address" text,
	"pincode" text,
	"state" text,
	"phone" text,
	"email" text,
	"currency_symbol" text,
	"nation_name" text,
	"bank_name" text,
	"bank_account_name" text,
	"account_no" text,
	"ifsc_code" text,
	"branch_name" text,
	"account_type" text,
	"gst_applicable" boolean DEFAULT false NOT NULL,
	"gst_type" text,
	"state_code" text,
	"city" text,
	"financial_year_start" date,
	"company_type" text DEFAULT 'general' NOT NULL,
	"market_category" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_customers" (
	"customer_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"customer_name" text NOT NULL,
	"gst_no" text,
	"phone" text,
	"email" text,
	"address" text,
	"opening_balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_inventory" (
	"inventory_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"inventory_code" text NOT NULL,
	"inventory_name" text NOT NULL,
	"unit" text NOT NULL,
	"gst_rate_id" bigint,
	"opening_stock_qty" numeric(15, 4) DEFAULT '0.0000' NOT NULL,
	"opening_stock_rate" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"hsn_code" text,
	"inventory_group_id" bigint,
	"inventory_category_id" bigint,
	"gst_type" text,
	"gst_percent" numeric(5, 2),
	"is_consumable" boolean DEFAULT false NOT NULL,
	"consume_with_inventory_id" integer,
	"consumption_ratio" numeric(15, 4),
	"shortage_percent" numeric(5, 2),
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_inventory_categories" (
	"inventory_category_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"category_name" text NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_inventory_groups" (
	"inventory_group_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"group_name" text NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_jobs" (
	"job_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"job_name" text NOT NULL,
	"address" text,
	"gst_no" text,
	"gst_type" text,
	"city" text,
	"state_code" text,
	"phone" text,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"msme_type" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_ledger_groups" (
	"group_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"group_name" text NOT NULL,
	"parent_group_id" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_ledgers" (
	"ledger_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"ledger_name" text NOT NULL,
	"short_name" text,
	"address" text,
	"group_id" bigint,
	"gst_no" text,
	"msme_type" text,
	"pan_no" text,
	"is_tds_applicable" boolean DEFAULT false NOT NULL,
	"tds_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"credit_days" integer DEFAULT 0 NOT NULL,
	"rate_of_interest" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"ledger_type" text NOT NULL,
	"reference_id" bigint,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_mills" (
	"mill_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"mill_name" text NOT NULL,
	"address" text,
	"gst_no" text,
	"gst_type" text,
	"city" text,
	"state_code" text,
	"phone" text,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"msme_type" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_suppliers" (
	"supplier_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"supplier_name" text NOT NULL,
	"gst_no" text,
	"phone" text,
	"email" text,
	"address" text,
	"opening_balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_tax_rates" (
	"tax_rate_id" serial PRIMARY KEY NOT NULL,
	"tax_name" text NOT NULL,
	"tax_percent" numeric(5, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_units_of_measurement" (
	"unit_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"unit_code" text NOT NULL,
	"unit_name" text NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"role" text DEFAULT 'company' NOT NULL,
	"company_id" bigint,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text,
	CONSTRAINT "m_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "p_accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "p_accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "p_sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "p_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "t_audit_logs" (
	"audit_log_id" serial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"record_id" bigint NOT NULL,
	"action_type" text NOT NULL,
	"old_data_json" jsonb,
	"new_data_json" jsonb,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "t_stock_movements" (
	"stock_movement_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"inventory_id" bigint NOT NULL,
	"voucher_id" bigint,
	"movement_type" text NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"rate" numeric(15, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "t_voucher_entries" (
	"voucher_entry_id" serial PRIMARY KEY NOT NULL,
	"voucher_id" bigint NOT NULL,
	"ledger_id" bigint NOT NULL,
	"entry_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "t_voucher_items" (
	"voucher_item_id" serial PRIMARY KEY NOT NULL,
	"voucher_id" bigint NOT NULL,
	"inventory_id" bigint NOT NULL,
	"ledger_id" bigint NOT NULL,
	"hsn_code" text,
	"pcs" integer DEFAULT 0 NOT NULL,
	"quantity" numeric(15, 4) DEFAULT '0.0000' NOT NULL,
	"fold" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"rate" numeric(15, 2) NOT NULL,
	"gst_rate_id" bigint,
	"taxable_amount" numeric(15, 2) NOT NULL,
	"cgst" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"sgst" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"igst" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"net_amount" numeric(15, 2) NOT NULL,
	"job_type" text,
	"job_rate_type" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "t_vouchers" (
	"voucher_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"voucher_no" text NOT NULL,
	"voucher_type" text NOT NULL,
	"voucher_date" date NOT NULL,
	"party_id" bigint,
	"remarks" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"net_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"broker" text,
	"haste" text,
	"lr_no" text,
	"lr_date" date,
	"transport" text,
	"vehicle_no" text,
	"person_name" text,
	"lot_no" text,
	"print_rate" boolean DEFAULT true NOT NULL,
	"print_amount" boolean DEFAULT true NOT NULL,
	"parent_voucher_id" bigint,
	"cash_bank_ledger_id" bigint,
	"bill_details" jsonb,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "m_customers" ADD CONSTRAINT "m_customers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory" ADD CONSTRAINT "m_inventory_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory" ADD CONSTRAINT "m_inventory_gst_rate_id_m_tax_rates_tax_rate_id_fk" FOREIGN KEY ("gst_rate_id") REFERENCES "public"."m_tax_rates"("tax_rate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory" ADD CONSTRAINT "m_inventory_inventory_group_id_m_inventory_groups_inventory_group_id_fk" FOREIGN KEY ("inventory_group_id") REFERENCES "public"."m_inventory_groups"("inventory_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory" ADD CONSTRAINT "m_inventory_inventory_category_id_m_inventory_categories_inventory_category_id_fk" FOREIGN KEY ("inventory_category_id") REFERENCES "public"."m_inventory_categories"("inventory_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory_categories" ADD CONSTRAINT "m_inventory_categories_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory_groups" ADD CONSTRAINT "m_inventory_groups_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_jobs" ADD CONSTRAINT "m_jobs_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_ledger_groups" ADD CONSTRAINT "m_ledger_groups_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD CONSTRAINT "m_ledgers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD CONSTRAINT "m_ledgers_group_id_m_ledger_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."m_ledger_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_mills" ADD CONSTRAINT "m_mills_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD CONSTRAINT "m_suppliers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_units_of_measurement" ADD CONSTRAINT "m_units_of_measurement_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_users" ADD CONSTRAINT "m_users_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p_accounts" ADD CONSTRAINT "p_accounts_userId_m_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."m_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p_sessions" ADD CONSTRAINT "p_sessions_userId_m_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."m_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_inventory_id_m_inventory_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."m_inventory"("inventory_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_entries" ADD CONSTRAINT "t_voucher_entries_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_entries" ADD CONSTRAINT "t_voucher_entries_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_inventory_id_m_inventory_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."m_inventory"("inventory_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_gst_rate_id_m_tax_rates_tax_rate_id_fk" FOREIGN KEY ("gst_rate_id") REFERENCES "public"."m_tax_rates"("tax_rate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD CONSTRAINT "t_vouchers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD CONSTRAINT "t_vouchers_cash_bank_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("cash_bank_ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_companies_company_name" ON "m_companies" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_m_customers_company_id" ON "m_customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_inventory_company_id" ON "m_inventory" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_inventory_gst_rate_id" ON "m_inventory" USING btree ("gst_rate_id");--> statement-breakpoint
CREATE INDEX "idx_m_inventory_categories_company_id" ON "m_inventory_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_inventory_groups_company_id" ON "m_inventory_groups" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_jobs_company_id" ON "m_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_ledger_groups_company_id" ON "m_ledger_groups" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_ledgers_company_id" ON "m_ledgers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_ledgers_reference_id_type" ON "m_ledgers" USING btree ("reference_id","ledger_type");--> statement-breakpoint
CREATE INDEX "idx_m_mills_company_id" ON "m_mills" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_suppliers_company_id" ON "m_suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_tax_rates_tax_name" ON "m_tax_rates" USING btree ("tax_name");--> statement-breakpoint
CREATE INDEX "idx_m_units_of_measurement_company_id" ON "m_units_of_measurement" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_t_audit_logs_table_name" ON "t_audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_t_audit_logs_action_type" ON "t_audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_t_stock_movements_company_id" ON "t_stock_movements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_t_stock_movements_inventory_id" ON "t_stock_movements" USING btree ("inventory_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_entries_voucher_id" ON "t_voucher_entries" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_entries_ledger_id" ON "t_voucher_entries" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_items_voucher_id" ON "t_voucher_items" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_items_inventory_id" ON "t_voucher_items" USING btree ("inventory_id");--> statement-breakpoint
CREATE INDEX "idx_t_vouchers_company_id" ON "t_vouchers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_t_vouchers_voucher_type" ON "t_vouchers" USING btree ("voucher_type");