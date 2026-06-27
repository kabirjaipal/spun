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
ALTER TABLE "m_users" ALTER COLUMN "role" SET DEFAULT 'company';--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "pincode" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "currency_symbol" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "nation_name" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "account_no" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "ifsc_code" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "account_type" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "gst_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "gst_type" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "state_code" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "short_name" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "group_id" bigint;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "gst_no" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "msme_type" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "pan_no" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "is_tds_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "tds_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "credit_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "rate_of_interest" numeric(5, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "m_ledger_groups" ADD CONSTRAINT "m_ledger_groups_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_ledger_groups_company_id" ON "m_ledger_groups" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD CONSTRAINT "m_ledgers_group_id_m_ledger_groups_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."m_ledger_groups"("group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_companies_company_name" ON "m_companies" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_m_customers_company_id" ON "m_customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_ledgers_company_id" ON "m_ledgers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_ledgers_reference_id_type" ON "m_ledgers" USING btree ("reference_id","ledger_type");--> statement-breakpoint
CREATE INDEX "idx_m_products_company_id" ON "m_products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_products_gst_rate_id" ON "m_products" USING btree ("gst_rate_id");--> statement-breakpoint
CREATE INDEX "idx_m_suppliers_company_id" ON "m_suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_tax_rates_tax_name" ON "m_tax_rates" USING btree ("tax_name");--> statement-breakpoint
CREATE INDEX "idx_t_audit_logs_table_name" ON "t_audit_logs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_t_audit_logs_action_type" ON "t_audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_t_stock_movements_company_id" ON "t_stock_movements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_t_stock_movements_product_id" ON "t_stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_entries_voucher_id" ON "t_voucher_entries" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_entries_ledger_id" ON "t_voucher_entries" USING btree ("ledger_id");--> statement-breakpoint
CREATE INDEX "idx_t_vouchers_company_id" ON "t_vouchers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_t_vouchers_voucher_type" ON "t_vouchers" USING btree ("voucher_type");