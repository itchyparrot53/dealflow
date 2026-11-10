ALTER TABLE "import_batches" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "import_rows" ADD COLUMN "marketing_status_before" text;--> statement-breakpoint
ALTER TABLE "import_rows" ADD COLUMN "marketing_person_id" uuid;