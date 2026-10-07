ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD COLUMN "last_error" text;
--> statement-breakpoint
UPDATE "pitaya"."gallery_reminder_deliveries" SET "lease_until" = "attempted_at" + interval '10 minutes', "attempt_count" = 1 WHERE "status" = 'SENDING';
