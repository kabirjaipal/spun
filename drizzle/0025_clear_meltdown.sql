ALTER TABLE "m_ledgers" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "cgst" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "sgst" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "igst" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "m_ledgers" ADD COLUMN "gst_rate" numeric(5, 2);