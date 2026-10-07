CREATE TABLE "pitaya"."favorite_galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_galleries_user_id_gallery_id_unique" UNIQUE("user_id","gallery_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."favorite_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_photos_user_id_photo_id_unique" UNIQUE("user_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."photo_selection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_selection_items_selection_id_photo_id_unique" UNIQUE("selection_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."photo_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."favorite_galleries" ADD CONSTRAINT "favorite_galleries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."favorite_galleries" ADD CONSTRAINT "favorite_galleries_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."favorite_photos" ADD CONSTRAINT "favorite_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."favorite_photos" ADD CONSTRAINT "favorite_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_selection_items" ADD CONSTRAINT "photo_selection_items_selection_id_photo_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "pitaya"."photo_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_selection_items" ADD CONSTRAINT "photo_selection_items_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_selections" ADD CONSTRAINT "photo_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;