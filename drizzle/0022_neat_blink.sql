ALTER TABLE "t_voucher_items" ADD COLUMN "grey_pcs" integer;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "grey_quantity" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "finish_pcs" integer;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "finish_quantity" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "tp" text;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "shortage_percent" numeric(5, 2);