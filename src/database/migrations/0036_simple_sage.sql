ALTER TABLE "pitaya"."users" ADD COLUMN "avatar" text;--> statement-breakpoint
ALTER TABLE "pitaya"."admin_notifications" ADD COLUMN "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."admin_notifications" ADD COLUMN "comment_id" uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_interactions" ADD COLUMN "parent_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_interactions" ADD COLUMN "edited_at" timestamp with time zone;