ALTER TABLE "t_vouchers" ADD COLUMN "tds_section" text;--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "tds_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "t_vouchers" ADD COLUMN "tds_amount" numeric(15, 2);