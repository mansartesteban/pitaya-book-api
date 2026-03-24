ALTER TABLE "pitaya"."companies" ALTER COLUMN "userId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."companies" ADD COLUMN "location" jsonb;