ALTER TABLE "pitaya"."galleries" ALTER COLUMN "visibility" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "pitaya"."gallery_visibility";--> statement-breakpoint
CREATE TYPE "pitaya"."gallery_visibility" AS ENUM('HIDDEN', 'PRIVATE', 'UNLISTED', 'PUBLIC');--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ALTER COLUMN "visibility" SET DATA TYPE "pitaya"."gallery_visibility" USING "visibility"::"pitaya"."gallery_visibility";