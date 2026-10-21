CREATE TABLE "dashboard_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"report_id" uuid,
	"goal_id" uuid,
	"size" text DEFAULT 'half' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_widgets_kind_ck" CHECK ("dashboard_widgets"."kind" in ('report', 'goal')),
	CONSTRAINT "dashboard_widgets_size_ck" CHECK ("dashboard_widgets"."size" in ('half', 'full')),
	CONSTRAINT "dashboard_widgets_target_ck" CHECK (("dashboard_widgets"."kind" = 'report' and "dashboard_widgets"."report_id" is not null and "dashboard_widgets"."goal_id" is null) or ("dashboard_widgets"."kind" = 'goal' and "dashboard_widgets"."goal_id" is not null and "dashboard_widgets"."report_id" is null))
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboards_name_ck" CHECK (char_length("dashboards"."name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_name_ck" CHECK (char_length("reports"."name") between 1 and 120),
	CONSTRAINT "reports_description_ck" CHECK (char_length("reports"."description") <= 500)
);
--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_widgets_dashboard_idx" ON "dashboard_widgets" USING btree ("dashboard_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "dashboards_default_uq" ON "dashboards" USING btree ("is_default") WHERE "dashboards"."is_default";--> statement-breakpoint
CREATE INDEX "reports_owner_idx" ON "reports" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "reports_shared_idx" ON "reports" USING btree ("shared") WHERE "reports"."shared";