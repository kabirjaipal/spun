CREATE TABLE "m_companies" (
	"company_id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"gst_no" text,
	"pan_no" text,
	"address" text,
	"financial_year_start" date,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
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
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
);
--> statement-breakpoint
CREATE TABLE "m_ledgers" (
	"ledger_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"ledger_name" text NOT NULL,
	"ledger_type" text NOT NULL,
	"reference_id" bigint,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
);
--> statement-breakpoint
CREATE TABLE "m_products" (
	"product_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"product_code" text NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"gst_rate_id" bigint,
	"opening_stock_qty" numeric(15, 4) DEFAULT '0.0000' NOT NULL,
	"opening_stock_rate" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
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
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
);
--> statement-breakpoint
CREATE TABLE "m_tax_rates" (
	"tax_rate_id" serial PRIMARY KEY NOT NULL,
	"tax_name" text NOT NULL,
	"tax_percent" numeric(5, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
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
	"role" text DEFAULT 'viewer' NOT NULL,
	"company_id" bigint,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint,
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
	"created_by" bigint
);
--> statement-breakpoint
CREATE TABLE "t_stock_movements" (
	"stock_movement_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"voucher_id" bigint,
	"movement_type" text NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"rate" numeric(15, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
);
--> statement-breakpoint
CREATE TABLE "t_voucher_entries" (
	"voucher_entry_id" serial PRIMARY KEY NOT NULL,
	"voucher_id" bigint NOT NULL,
	"ledger_id" bigint NOT NULL,
	"entry_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
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
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" bigint,
	"deleted_on" timestamp,
	"deleted_by" bigint
);
--> statement-breakpoint
ALTER TABLE "m_customers" ADD CONSTRAINT "m_customers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD CONSTRAINT "m_ledgers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_products" ADD CONSTRAINT "m_products_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_products" ADD CONSTRAINT "m_products_gst_rate_id_m_tax_rates_tax_rate_id_fk" FOREIGN KEY ("gst_rate_id") REFERENCES "public"."m_tax_rates"("tax_rate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD CONSTRAINT "m_suppliers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_users" ADD CONSTRAINT "m_users_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p_accounts" ADD CONSTRAINT "p_accounts_userId_m_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."m_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p_sessions" ADD CONSTRAINT "p_sessions_userId_m_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."m_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_product_id_m_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."m_products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_stock_movements" ADD CONSTRAINT "t_stock_movements_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_entries" ADD CONSTRAINT "t_voucher_entries_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_entries" ADD CONSTRAINT "t_voucher_entries_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD CONSTRAINT "t_vouchers_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;