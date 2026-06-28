ALTER TABLE "m_suppliers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "m_suppliers" CASCADE;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "parent_company_id" bigint;--> statement-breakpoint
ALTER TABLE "m_companies" ADD CONSTRAINT "m_companies_parent_company_id_m_companies_company_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_companies_parent_company_id" ON "m_companies" USING btree ("parent_company_id");