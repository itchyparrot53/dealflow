CREATE TABLE "email_design" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"display_name" text,
	"accent_color" text DEFAULT '#2D8548' NOT NULL,
	"show_address" boolean DEFAULT true NOT NULL,
	"footer_text" text,
	"show_powered_by" boolean DEFAULT false NOT NULL,
	"new_email_layout" text DEFAULT 'branded' NOT NULL,
	"reply_layout" text DEFAULT 'minimal' NOT NULL,
	"footer_on_replies" boolean DEFAULT false NOT NULL,
	"logo_bytes" "bytea",
	"logo_mime" text,
	"logo_hash" text,
	"logo_width" integer,
	"logo_height" integer,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_design_singleton_ck" CHECK ("email_design"."id" = 1),
	CONSTRAINT "email_design_accent_ck" CHECK ("email_design"."accent_color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "email_design_new_layout_ck" CHECK ("email_design"."new_email_layout" in ('branded','plain')),
	CONSTRAINT "email_design_reply_layout_ck" CHECK ("email_design"."reply_layout" in ('minimal','branded','plain')),
	CONSTRAINT "email_design_logo_mime_ck" CHECK ("email_design"."logo_mime" in ('image/png','image/jpeg'))
);
--> statement-breakpoint
CREATE TABLE "email_template_overrides" (
	"key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"preheader" text,
	"body_html" text NOT NULL,
	"cta_label" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_design" ADD CONSTRAINT "email_design_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_overrides" ADD CONSTRAINT "email_template_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "email_design" ("id") VALUES (1) ON CONFLICT DO NOTHING;
