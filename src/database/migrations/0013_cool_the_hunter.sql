ALTER TABLE "pitaya"."photos" ADD COLUMN "width" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."photos" ADD COLUMN "height" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."photos" ADD COLUMN "ratio" numeric(3) NOT NULL;