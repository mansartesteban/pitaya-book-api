CREATE TABLE "pitaya"."gallery_manager_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_manager_grants_gallery_id_contact_id_unique" UNIQUE("gallery_id","contact_id")
);
--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_grants" ADD CONSTRAINT "gallery_manager_grants_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_grants" ADD CONSTRAINT "gallery_manager_grants_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "pitaya"."company_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_manager_grants" ADD CONSTRAINT "gallery_manager_grants_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;