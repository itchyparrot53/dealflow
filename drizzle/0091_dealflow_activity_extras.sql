CREATE TABLE "activity_calls" (
	"activity_id" uuid PRIMARY KEY NOT NULL,
	"outcome" text NOT NULL,
	"direction" text NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_calls_outcome_ck" CHECK ("activity_calls"."outcome" in ('connected','no_answer','left_voicemail','busy','wrong_number')),
	CONSTRAINT "activity_calls_direction_ck" CHECK ("activity_calls"."direction" in ('outbound','inbound')),
	CONSTRAINT "activity_calls_duration_ck" CHECK ("activity_calls"."duration_seconds" is null or ("activity_calls"."duration_seconds" between 0 and 86400))
);
--> statement-breakpoint
CREATE TABLE "activity_recurrence" (
	"activity_id" uuid PRIMARY KEY NOT NULL,
	"series_id" uuid NOT NULL,
	"rule" jsonb NOT NULL,
	"anchor_day" integer NOT NULL,
	"occurrence" integer DEFAULT 1 NOT NULL,
	"ended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_recurrence_anchor_day_ck" CHECK ("activity_recurrence"."anchor_day" between 1 and 31),
	CONSTRAINT "activity_recurrence_occurrence_ck" CHECK ("activity_recurrence"."occurrence" >= 1)
);
--> statement-breakpoint
CREATE TABLE "duplicate_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"a_id" uuid NOT NULL,
	"b_id" uuid NOT NULL,
	"dismissed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_dismissals_pair_uq" UNIQUE("entity","a_id","b_id"),
	CONSTRAINT "duplicate_dismissals_entity_ck" CHECK ("duplicate_dismissals"."entity" in ('person','organization')),
	CONSTRAINT "duplicate_dismissals_order_ck" CHECK ("duplicate_dismissals"."a_id" < "duplicate_dismissals"."b_id")
);
--> statement-breakpoint
ALTER TABLE "activity_calls" ADD CONSTRAINT "activity_calls_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_recurrence" ADD CONSTRAINT "activity_recurrence_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_dismissals" ADD CONSTRAINT "duplicate_dismissals_dismissed_by_users_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_recurrence_series_idx" ON "activity_recurrence" USING btree ("series_id");