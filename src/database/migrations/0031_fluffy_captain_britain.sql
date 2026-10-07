CREATE TABLE "pitaya"."gallery_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"photo_id" uuid,
	"user_id" uuid,
	"guest_email" text,
	"guest_name" text,
	"kind" text NOT NULL,
	"content" text,
	"reaction" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"verification_token_hash" text,
	"verification_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_interactions" ADD CONSTRAINT "gallery_interactions_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_interactions" ADD CONSTRAINT "gallery_interactions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_interactions" ADD CONSTRAINT "gallery_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;