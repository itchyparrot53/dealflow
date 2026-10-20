CREATE TABLE "session_auth_events" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"authenticated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_auth_events" ADD CONSTRAINT "session_auth_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;