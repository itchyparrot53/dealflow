CREATE TYPE "public"."marketing_status" AS ENUM('not_subscribed', 'pending', 'subscribed', 'unsubscribed', 'bounced');--> statement-breakpoint
CREATE TABLE "campaign_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_assets_mime_ck" CHECK ("campaign_assets"."mime" in ('image/png','image/jpeg','image/gif')),
	CONSTRAINT "campaign_assets_size_ck" CHECK ("campaign_assets"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"person_id" uuid,
	"type" text NOT NULL,
	"link_index" integer,
	"user_agent_family" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_events_type_ck" CHECK ("campaign_events"."type" in ('open','click','unsubscribe','bounce_hard','bounce_soft','complaint','delivered'))
);
--> statement-breakpoint
CREATE TABLE "campaign_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"link_index" integer NOT NULL,
	"url_template" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_links_index_ck" CHECK ("campaign_links"."link_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"person_id" uuid,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_recipients_status_ck" CHECK ("campaign_recipients"."status" in ('queued','sending','sent','bounced_hard','failed_soft','skipped_status','skipped_suppressed','skipped_cancelled')),
	CONSTRAINT "campaign_recipients_attempts_ck" CHECK ("campaign_recipients"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_name" text NOT NULL,
	"from_email" "citext" NOT NULL,
	"verified_at" timestamp with time zone,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"postal_address" text,
	"require_double_opt_in" boolean DEFAULT true NOT NULL,
	"consent_label" text,
	"send_rate_per_minute" integer DEFAULT 60 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_settings_singleton_ck" CHECK ("campaign_settings"."id" = 1),
	CONSTRAINT "campaign_settings_rate_ck" CHECK ("campaign_settings"."send_rate_per_minute" > 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'newsletter' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"preheader" text,
	"sender_id" uuid,
	"reply_to" text,
	"segment" jsonb,
	"content" jsonb,
	"template_id" uuid,
	"scheduled_at" timestamp with time zone,
	"created_by" uuid,
	"send_as_user_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rate_window_started_at" timestamp with time zone,
	"rate_sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_type_ck" CHECK ("campaigns"."type" in ('newsletter','announcement','promotion','event','nurture','other')),
	CONSTRAINT "campaigns_status_ck" CHECK ("campaigns"."status" in ('draft','scheduled','sending','paused','sent','cancelled')),
	CONSTRAINT "campaigns_rate_count_ck" CHECK ("campaigns"."rate_sent_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sequence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_position" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exit_reason" text,
	CONSTRAINT "sequence_enrollments_status_ck" CHECK ("sequence_enrollments"."status" in ('active','completed','exited','failed'))
);
--> statement-breakpoint
CREATE TABLE "sequence_segment_members" (
	"sequence_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_segment_members_sequence_id_person_id_pk" PRIMARY KEY("sequence_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"preheader" text,
	"content" jsonb,
	"wait_minutes" integer,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_steps_kind_ck" CHECK ("sequence_steps"."kind" in ('email','wait')),
	CONSTRAINT "sequence_steps_wait_ck" CHECK ("sequence_steps"."wait_minutes" is null or "sequence_steps"."wait_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sender_id" uuid,
	"reply_to" text,
	"entry" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"exit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"send_window" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequences_status_ck" CHECK ("sequences"."status" in ('draft','active','paused'))
);
--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"email_hash" text NOT NULL,
	"from_status" "marketing_status",
	"to_status" "marketing_status" NOT NULL,
	"source" text NOT NULL,
	"basis" text,
	"actor_user_id" uuid,
	"ip" text,
	"user_agent" text,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_events_source_ck" CHECK ("consent_events"."source" in ('manual','bulk','import','form','double_opt_in','unsubscribe_link','one_click','preference_page','bounce','complaint','system')),
	CONSTRAINT "consent_events_basis_ck" CHECK ("consent_events"."basis" is null or "consent_events"."basis" in ('double_opt_in','form_consent','explicit','legitimate_interest','imported'))
);
--> statement-breakpoint
CREATE TABLE "marketing_suppressions" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_suppressions_reason_ck" CHECK ("marketing_suppressions"."reason" in ('unsubscribed','hard_bounce','complaint'))
);
--> statement-breakpoint
CREATE TABLE "marketing_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"person_id" uuid,
	"campaign_recipient_id" uuid,
	"sender_id" uuid,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_tokens_purpose_ck" CHECK ("marketing_tokens"."purpose" in ('doi','unsub','sender'))
);
--> statement-breakpoint
CREATE TABLE "person_marketing" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"status" "marketing_status" DEFAULT 'not_subscribed' NOT NULL,
	"consent_basis" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"soft_bounce_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "person_marketing_basis_ck" CHECK ("person_marketing"."consent_basis" is null or "person_marketing"."consent_basis" in ('double_opt_in','form_consent','explicit','legitimate_interest','imported')),
	CONSTRAINT "person_marketing_soft_bounce_ck" CHECK ("person_marketing"."soft_bounce_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "campaign_assets" ADD CONSTRAINT "campaign_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_recipient_id_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_links" ADD CONSTRAINT "campaign_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_senders" ADD CONSTRAINT "campaign_senders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_templates" ADD CONSTRAINT "campaign_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sender_id_campaign_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."campaign_senders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_campaign_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."campaign_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_send_as_user_id_users_id_fk" FOREIGN KEY ("send_as_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_segment_members" ADD CONSTRAINT "sequence_segment_members_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_segment_members" ADD CONSTRAINT "sequence_segment_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_sender_id_campaign_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."campaign_senders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_tokens" ADD CONSTRAINT "marketing_tokens_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_marketing" ADD CONSTRAINT "person_marketing_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_assets_sha256_uq" ON "campaign_assets" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "campaign_events_campaign_type_idx" ON "campaign_events" USING btree ("campaign_id","type");--> statement-breakpoint
CREATE INDEX "campaign_events_person_idx" ON "campaign_events" USING btree ("person_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_links_campaign_index_uq" ON "campaign_links" USING btree ("campaign_id","link_index");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_email_uq" ON "campaign_recipients" USING btree ("campaign_id","email_hash");--> statement-breakpoint
CREATE INDEX "campaign_recipients_queue_idx" ON "campaign_recipients" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_senders_email_uq" ON "campaign_senders" USING btree ("from_email");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_senders_default_uq" ON "campaign_senders" USING btree ("is_default") WHERE "campaign_senders"."is_default";--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_enrollments_active_uq" ON "sequence_enrollments" USING btree ("sequence_id","person_id") WHERE "sequence_enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "sequence_enrollments_due_idx" ON "sequence_enrollments" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_steps_position_uq" ON "sequence_steps" USING btree ("sequence_id","position");--> statement-breakpoint
CREATE INDEX "consent_events_person_idx" ON "consent_events" USING btree ("person_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "consent_events_email_hash_idx" ON "consent_events" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "marketing_tokens_person_idx" ON "marketing_tokens" USING btree ("person_id","purpose");--> statement-breakpoint
CREATE INDEX "marketing_tokens_sender_idx" ON "marketing_tokens" USING btree ("sender_id");
--> statement-breakpoint
INSERT INTO "campaign_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
