ALTER TABLE "email_threads" RENAME COLUMN "gmail_thread_id" TO "provider_thread_id";--> statement-breakpoint
ALTER TABLE "email_messages" RENAME COLUMN "gmail_message_id" TO "provider_message_id";--> statement-breakpoint
ALTER TABLE "email_send_attempts" RENAME COLUMN "gmail_message_id" TO "provider_message_id";--> statement-breakpoint
ALTER TABLE "email_message_attachments" RENAME COLUMN "gmail_attachment_id" TO "provider_attachment_id";--> statement-breakpoint
ALTER TABLE "email_accounts" RENAME COLUMN "last_history_id" TO "sync_cursor";
