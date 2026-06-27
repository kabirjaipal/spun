ALTER TABLE "m_suppliers" ADD COLUMN "pan_no" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "pincode" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "currency_symbol" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "nation_name" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "account_no" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "ifsc_code" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "account_type" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "gst_applicable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "gst_type" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "state_code" text;--> statement-breakpoint
ALTER TABLE "m_suppliers" ADD COLUMN "city" text;