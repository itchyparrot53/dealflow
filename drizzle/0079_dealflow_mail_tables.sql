CREATE TABLE "email_message_headers" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"rfc822_message_id" text NOT NULL,
	"in_reply_to" text,
	"references" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_account_credentials" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer NOT NULL,
	"imap_secure" boolean DEFAULT true NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"username" text NOT NULL,
	"password_enc" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_folder_cursors" (
	"account_id" uuid NOT NULL,
	"folder" text NOT NULL,
	"special_use" text,
	"uid_validity" bigint NOT NULL,
	"last_uid" bigint DEFAULT 0 NOT NULL,
	"uid_next" bigint DEFAULT 0 NOT NULL,
	"highest_modseq" bigint,
	"backfill_before" timestamp with time zone,
	"backfill_done" boolean DEFAULT false NOT NULL,
	"last_listed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_folder_cursors_account_id_folder_pk" PRIMARY KEY("account_id","folder")
);
--> statement-breakpoint
CREATE TABLE "mail_message_locations" (
	"account_id" uuid NOT NULL,
	"folder" text NOT NULL,
	"uid_validity" bigint NOT NULL,
	"uid" bigint NOT NULL,
	"provider_message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_message_locations_account_id_folder_uid_validity_uid_pk" PRIMARY KEY("account_id","folder","uid_validity","uid")
);
--> statement-breakpoint
CREATE TABLE "mail_sent_appends" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"last_error_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_message_headers" ADD CONSTRAINT "email_message_headers_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_account_credentials" ADD CONSTRAINT "mail_account_credentials_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_folder_cursors" ADD CONSTRAINT "mail_folder_cursors_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_message_locations" ADD CONSTRAINT "mail_message_locations_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_sent_appends" ADD CONSTRAINT "mail_sent_appends_attempt_id_email_send_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."email_send_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emh_account_rfc_idx" ON "email_message_headers" USING btree ("account_id","rfc822_message_id");--> statement-breakpoint
CREATE INDEX "mml_account_msg_idx" ON "mail_message_locations" USING btree ("account_id","provider_message_id");