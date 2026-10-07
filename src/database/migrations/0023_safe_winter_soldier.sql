CREATE TABLE "pitaya"."company_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"firstname" text NOT NULL,
	"lastname" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"gallery_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"event_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "admin_notifications_owner_user_id_event_key_unique" UNIQUE("owner_user_id","event_key")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."gallery_reminder_contacts" (
	"gallery_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "gallery_reminder_contacts_gallery_id_contact_id_unique" UNIQUE("gallery_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."gallery_reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"status" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "gallery_reminder_deliveries_contact_id_event_key_unique" UNIQUE("contact_id","event_key")
);
--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD COLUMN "reminder_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD COLUMN "client_company_id" uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."company_contacts" ADD CONSTRAINT "company_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "pitaya"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."admin_notifications" ADD CONSTRAINT "admin_notifications_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."admin_notifications" ADD CONSTRAINT "admin_notifications_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_contacts" ADD CONSTRAINT "gallery_reminder_contacts_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_contacts" ADD CONSTRAINT "gallery_reminder_contacts_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "pitaya"."company_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD CONSTRAINT "gallery_reminder_deliveries_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_deliveries" ADD CONSTRAINT "gallery_reminder_deliveries_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "pitaya"."company_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD CONSTRAINT "galleries_client_company_id_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "pitaya"."companies"("id") ON DELETE set null ON UPDATE no action;