ALTER TABLE "pitaya"."galleries" ADD COLUMN "reminder_value" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD COLUMN "reminder_unit" text DEFAULT 'DAY' NOT NULL;--> statement-breakpoint
UPDATE "pitaya"."galleries" SET "reminder_value" = "reminder_days";
