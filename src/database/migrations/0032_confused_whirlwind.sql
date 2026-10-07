CREATE TABLE "pitaya"."gallery_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"photo_id" uuid,
	"visitor_hash" text NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_view_events" ADD CONSTRAINT "gallery_view_events_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_view_events" ADD CONSTRAINT "gallery_view_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_view_events" ADD CONSTRAINT "gallery_view_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_view_events_gallery_date_idx" ON "pitaya"."gallery_view_events" USING btree ("gallery_id","created_at");