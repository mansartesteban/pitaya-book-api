ALTER TABLE "pitaya"."documents" RENAME COLUMN "name" TO "filename";--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD COLUMN "stored_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD COLUMN "mimetype" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD COLUMN "extension" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD COLUMN "folder" text;--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD COLUMN "path" text NOT NULL;