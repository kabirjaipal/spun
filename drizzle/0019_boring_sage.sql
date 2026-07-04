ALTER TABLE "t_voucher_items" ALTER COLUMN "inventory_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD COLUMN "ledger_id" bigint;--> statement-breakpoint
ALTER TABLE "t_voucher_items" ADD CONSTRAINT "t_voucher_items_ledger_id_m_ledgers_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."m_ledgers"("ledger_id") ON DELETE no action ON UPDATE no action;