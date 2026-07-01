ALTER TABLE "t_voucher_items" DROP CONSTRAINT "t_voucher_items_ledger_id_m_ledgers_ledger_id_fk";
--> statement-breakpoint
ALTER TABLE "t_voucher_items" DROP COLUMN "ledger_id";