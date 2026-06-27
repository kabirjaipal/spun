ALTER TABLE "m_companies" ADD COLUMN "company_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "market_category" text;