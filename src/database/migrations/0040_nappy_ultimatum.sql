CREATE TABLE "pitaya"."member_gallery_layouts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"layout" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."member_gallery_layouts" ADD CONSTRAINT "member_gallery_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;