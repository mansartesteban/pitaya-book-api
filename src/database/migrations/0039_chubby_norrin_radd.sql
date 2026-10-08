CREATE TABLE "pitaya"."gallery_manager_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"email" text NOT NULL,
	"firstname" text,
	"lastname" text,
	"contact_id" uuid,
	"invited_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_manager_invitations_gallery_id_email_unique" UNIQUE("gallery_id","email")
);
--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_invitations" ADD CONSTRAINT "gallery_manager_invitations_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_invitations" ADD CONSTRAINT "gallery_manager_invitations_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "pitaya"."company_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_invitations" ADD CONSTRAINT "gallery_manager_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;