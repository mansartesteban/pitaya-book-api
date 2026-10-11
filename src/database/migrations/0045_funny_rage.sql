CREATE TABLE "pitaya"."comment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "comment_reports_comment_id_reporter_user_id_unique" UNIQUE("comment_id","reporter_user_id")
);
--> statement-breakpoint
ALTER TABLE "pitaya"."comment_reports" ADD CONSTRAINT "comment_reports_comment_id_gallery_interactions_id_fk" FOREIGN KEY ("comment_id") REFERENCES "pitaya"."gallery_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."comment_reports" ADD CONSTRAINT "comment_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;