CREATE TABLE "document_counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer NOT NULL,
	CONSTRAINT "document_counters_kind_year_pk" PRIMARY KEY("kind","year"),
	CONSTRAINT "document_counters_kind_ck" CHECK ("document_counters"."kind" in ('quote', 'invoice')),
	CONSTRAINT "document_counters_last_number_ck" CHECK ("document_counters"."last_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"quantity" numeric(12, 3) NOT NULL,
	"item_price" numeric(14, 2) NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	"tax_percent" numeric(5, 2) NOT NULL,
	"net" numeric(14, 2) NOT NULL,
	"tax" numeric(14, 2) NOT NULL,
	"gross" numeric(14, 2) NOT NULL,
	CONSTRAINT "document_lines_quantity_ck" CHECK ("document_lines"."quantity" > 0),
	CONSTRAINT "document_lines_item_price_ck" CHECK ("document_lines"."item_price" >= 0),
	CONSTRAINT "document_lines_discount_percent_ck" CHECK ("document_lines"."discount_percent" between 0 and 100),
	CONSTRAINT "document_lines_tax_percent_ck" CHECK ("document_lines"."tax_percent" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "document_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_payments_amount_ck" CHECK ("document_payments"."amount" > 0),
	CONSTRAINT "document_payments_method_ck" CHECK ("document_payments"."method" in ('bank_transfer', 'card', 'cash', 'other'))
);
--> statement-breakpoint
CREATE TABLE "document_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"quote_prefix" text DEFAULT 'Q' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"quote_valid_days" integer DEFAULT 30 NOT NULL,
	"invoice_due_days" integer DEFAULT 14 NOT NULL,
	"company_name" text,
	"company_address" text,
	"company_tax_id" text,
	"payment_instructions" text,
	"footer" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_settings_singleton_ck" CHECK ("document_settings"."id"),
	CONSTRAINT "document_settings_quote_prefix_ck" CHECK ("document_settings"."quote_prefix" ~ '^[A-Z0-9]{1,8}$'),
	CONSTRAINT "document_settings_invoice_prefix_ck" CHECK ("document_settings"."invoice_prefix" ~ '^[A-Z0-9]{1,8}$'),
	CONSTRAINT "document_settings_quote_valid_days_ck" CHECK ("document_settings"."quote_valid_days" between 1 and 365),
	CONSTRAINT "document_settings_invoice_due_days_ck" CHECK ("document_settings"."invoice_due_days" between 1 and 365)
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"terms" text,
	"include_products" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_templates_kind_ck" CHECK ("document_templates"."kind" in ('quote', 'invoice')),
	CONSTRAINT "document_templates_body_ck" CHECK (char_length("document_templates"."body") <= 20000),
	CONSTRAINT "document_templates_terms_ck" CHECK (char_length("document_templates"."terms") <= 5000)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"deal_id" uuid NOT NULL,
	"template_id" uuid,
	"source_quote_id" uuid,
	"public_id" text NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"currency" char(3) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_address" text,
	"issue_date" date,
	"valid_until" date,
	"due_date" date,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"accepted_name" text,
	"accepted_ip" text,
	"decline_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "documents_number_unique" UNIQUE("number"),
	CONSTRAINT "documents_kind_ck" CHECK ("documents"."kind" in ('quote', 'invoice')),
	CONSTRAINT "documents_status_ck" CHECK ("documents"."status" in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'overdue', 'paid', 'void')),
	CONSTRAINT "documents_title_ck" CHECK (char_length("documents"."title") between 1 and 150),
	CONSTRAINT "documents_decline_reason_ck" CHECK (char_length("documents"."decline_reason") <= 500)
);
--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_payments" ADD CONSTRAINT "document_payments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_payments" ADD CONSTRAINT "document_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_quote_id_documents_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_lines_document_position_idx" ON "document_lines" USING btree ("document_id","position");--> statement-breakpoint
CREATE INDEX "document_payments_document_idx" ON "document_payments" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_templates_default_uq" ON "document_templates" USING btree ("kind") WHERE "document_templates"."is_default";--> statement-breakpoint
CREATE INDEX "documents_deal_idx" ON "documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "documents_kind_status_idx" ON "documents" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "documents_due_date_idx" ON "documents" USING btree ("due_date") WHERE "documents"."kind" = 'invoice';