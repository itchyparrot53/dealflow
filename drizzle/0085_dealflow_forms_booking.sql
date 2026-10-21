CREATE TABLE "booking_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"min_notice_hours" integer DEFAULT 4 NOT NULL,
	"days_ahead" integer DEFAULT 30 NOT NULL,
	"timezone" text NOT NULL,
	"availability" jsonb NOT NULL,
	"activity_type_id" uuid NOT NULL,
	"location" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_pages_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "booking_pages_title_ck" CHECK (char_length("booking_pages"."title") between 1 and 120),
	CONSTRAINT "booking_pages_description_ck" CHECK (char_length("booking_pages"."description") <= 1000),
	CONSTRAINT "booking_pages_duration_ck" CHECK ("booking_pages"."duration_minutes" between 15 and 240),
	CONSTRAINT "booking_pages_buffer_ck" CHECK ("booking_pages"."buffer_minutes" between 0 and 120),
	CONSTRAINT "booking_pages_notice_ck" CHECK ("booking_pages"."min_notice_hours" between 0 and 168),
	CONSTRAINT "booking_pages_days_ahead_ck" CHECK ("booking_pages"."days_ahead" between 1 and 90),
	CONSTRAINT "booking_pages_location_ck" CHECK (char_length("booking_pages"."location") <= 300)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"activity_id" uuid,
	"person_id" uuid,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"visitor_name" text NOT NULL,
	"visitor_email" text NOT NULL,
	"note" text,
	"cancel_token_hash" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_cancel_token_hash_unique" UNIQUE("cancel_token_hash"),
	CONSTRAINT "bookings_status_ck" CHECK ("bookings"."status" in ('booked', 'cancelled')),
	CONSTRAINT "bookings_visitor_name_ck" CHECK (char_length("bookings"."visitor_name") between 1 and 100),
	CONSTRAINT "bookings_note_ck" CHECK (char_length("bookings"."note") <= 1000),
	CONSTRAINT "bookings_span_ck" CHECK ("bookings"."end_at" > "bookings"."start_at")
);
--> statement-breakpoint
CREATE TABLE "web_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"values" jsonb NOT NULL,
	"person_id" uuid,
	"lead_id" uuid,
	"deal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"fields" jsonb NOT NULL,
	"creates" text NOT NULL,
	"pipeline_id" uuid,
	"stage_id" uuid,
	"owner_id" uuid NOT NULL,
	"success_message" text DEFAULT 'Thanks, we will be in touch.' NOT NULL,
	"redirect_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_forms_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "web_forms_name_ck" CHECK (char_length("web_forms"."name") between 1 and 120),
	CONSTRAINT "web_forms_title_ck" CHECK (char_length("web_forms"."title") between 1 and 150),
	CONSTRAINT "web_forms_description_ck" CHECK (char_length("web_forms"."description") <= 1000),
	CONSTRAINT "web_forms_creates_ck" CHECK ("web_forms"."creates" in ('lead', 'deal')),
	CONSTRAINT "web_forms_redirect_url_ck" CHECK ("web_forms"."redirect_url" is null or "web_forms"."redirect_url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_pages" ADD CONSTRAINT "booking_pages_activity_type_id_activity_types_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_page_id_booking_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."booking_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_form_submissions" ADD CONSTRAINT "web_form_submissions_form_id_web_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."web_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_form_submissions" ADD CONSTRAINT "web_form_submissions_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_form_submissions" ADD CONSTRAINT "web_form_submissions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_form_submissions" ADD CONSTRAINT "web_form_submissions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_forms" ADD CONSTRAINT "web_forms_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_forms" ADD CONSTRAINT "web_forms_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_forms" ADD CONSTRAINT "web_forms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_forms" ADD CONSTRAINT "web_forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_page_start_idx" ON "bookings" USING btree ("page_id","start_at");--> statement-breakpoint
CREATE INDEX "web_form_submissions_form_idx" ON "web_form_submissions" USING btree ("form_id","created_at" DESC NULLS LAST);