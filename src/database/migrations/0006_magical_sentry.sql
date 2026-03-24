ALTER TYPE "pitaya"."document_type" RENAME TO "document_category";--> statement-breakpoint
ALTER TABLE "pitaya"."documents" RENAME COLUMN "type" TO "category";--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "pitaya"."document_category";--> statement-breakpoint
CREATE TYPE "pitaya"."document_category" AS ENUM('SERVICE', 'OTHER');--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ALTER COLUMN "category" SET DATA TYPE "pitaya"."document_category" USING "category"::"pitaya"."document_category";