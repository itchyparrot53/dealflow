CREATE TABLE "currency_rates" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"rate_to_base" numeric(18, 8) NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currency_rates_rate_ck" CHECK ("currency_rates"."rate_to_base" > 0)
);
--> statement-breakpoint
CREATE TABLE "deal_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"item_price" numeric(14, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_products_quantity_ck" CHECK ("deal_products"."quantity" > 0),
	CONSTRAINT "deal_products_item_price_ck" CHECK ("deal_products"."item_price" >= 0),
	CONSTRAINT "deal_products_discount_percent_ck" CHECK ("deal_products"."discount_percent" between 0 and 100),
	CONSTRAINT "deal_products_tax_percent_ck" CHECK ("deal_products"."tax_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "deal_terms" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"currency" char(3) NOT NULL,
	"probability" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_terms_probability_ck" CHECK ("deal_terms"."probability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"unit" text,
	"price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_ck" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_tax_percent_ck" CHECK ("products"."tax_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "stage_probabilities" (
	"stage_id" uuid PRIMARY KEY NOT NULL,
	"probability" integer NOT NULL,
	CONSTRAINT "stage_probabilities_probability_ck" CHECK ("stage_probabilities"."probability" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_products" ADD CONSTRAINT "deal_products_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_products" ADD CONSTRAINT "deal_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_terms" ADD CONSTRAINT "deal_terms_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_probabilities" ADD CONSTRAINT "stage_probabilities_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_products_deal_position_idx" ON "deal_products" USING btree ("deal_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "products_code_uq" ON "products" USING btree ("code") WHERE "products"."code" is not null;