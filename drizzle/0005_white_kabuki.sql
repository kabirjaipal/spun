CREATE TABLE "t_voucher_items" (
	"voucher_item_id" serial PRIMARY KEY NOT NULL,
	"voucher_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
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
ALTER TABLE "t_vouchers" ADD COLUMN "broker" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "haste" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "lr_no" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "lr_date" date;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "transport" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "vehicle_no" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "person_name" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "lot_no" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "print_rate" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "print_amount" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "parent_voucher_id" bigint;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "cash_bank_ledger_id" bigint;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_voucher_id_t_vouchers_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."t_vouchers"("voucher_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_product_id_m_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."m_products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_gst_rate_id_m_tax_rates_tax_rate_id_fk" FOREIGN KEY ("gst_rate_id") REFERENCES "public"."m_tax_rates"("tax_rate_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_t_voucher_items_voucher_id" ON "t_voucher_items" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "idx_t_voucher_items_product_id" ON "t_voucher_items" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD CONSTRAINT "t_vouchers_cash_bank_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("cash_bank_ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;