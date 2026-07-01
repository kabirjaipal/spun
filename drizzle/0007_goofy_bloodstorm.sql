CREATE TABLE "m_brokers_haste" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "m_brokers_haste" ADD CONSTRAINT "m_brokers_haste_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_brokers_haste_company_id" ON "m_brokers_haste" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_brokers_haste_type" ON "m_brokers_haste" USING btree ("type");