CREATE TABLE "m_inventory_categories" (
	"inventory_category_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"category_name" text NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_inventory_groups" (
	"inventory_group_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"group_name" text NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_jobs" (
	"job_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"job_name" text NOT NULL,
	"address" text,
	"gst_no" text,
	"gst_type" text,
	"city" text,
	"state_code" text,
	"phone" text,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"msme_type" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_mills" (
	"mill_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"mill_name" text NOT NULL,
	"address" text,
	"gst_no" text,
	"gst_type" text,
	"city" text,
	"state_code" text,
	"phone" text,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"msme_type" text,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
CREATE TABLE "m_units_of_measurement" (
	"unit_id" serial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"unit_code" text NOT NULL,
	"unit_name" text NOT NULL,
	"is_fixed" boolean DEFAULT false NOT NULL,
	"created_on" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_on" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	"deleted_on" timestamp,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "hsn_code" text;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "inventory_group_id" bigint;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "inventory_category_id" bigint;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "gst_type" text;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "gst_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "is_consumable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "consume_with_product_id" integer;--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "consumption_ratio" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "m_products" ADD COLUMN "shortage_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "m_inventory_categories" ADD CONSTRAINT "m_inventory_categories_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_inventory_groups" ADD CONSTRAINT "m_inventory_groups_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_jobs" ADD CONSTRAINT "m_jobs_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_mills" ADD CONSTRAINT "m_mills_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_units_of_measurement" ADD CONSTRAINT "m_units_of_measurement_company_id_m_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."m_companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_m_inventory_categories_company_id" ON "m_inventory_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_inventory_groups_company_id" ON "m_inventory_groups" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_jobs_company_id" ON "m_jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_mills_company_id" ON "m_mills" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_m_units_of_measurement_company_id" ON "m_units_of_measurement" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "m_products" ADD CONSTRAINT "m_products_inventory_group_id_m_inventory_groups_inventory_group_id_fk" FOREIGN KEY ("inventory_group_id") REFERENCES "public"."m_inventory_groups"("inventory_group_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m_products" ADD CONSTRAINT "m_products_inventory_category_id_m_inventory_categories_inventory_category_id_fk" FOREIGN KEY ("inventory_category_id") REFERENCES "public"."m_inventory_categories"("inventory_category_id") ON DELETE no action ON UPDATE no action;