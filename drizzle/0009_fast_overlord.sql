CREATE TABLE "m_voucher_sequences" (
	"sequence_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"voucher_type" text NOT NULL,
	"prefix" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "m_voucher_sequences" ADD CONSTRAINT "m_voucher_sequences_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_voucher_sequences_company_type" ON "m_voucher_sequences" USING btree ("company_id","voucher_type");