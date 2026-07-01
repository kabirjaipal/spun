DROP TABLE "m_customers" CASCADE;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "msme_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "msme_type" text;--> statement-breakpoint
ALTER TABLE "m_companies" ADD COLUMN "msme_no" text;