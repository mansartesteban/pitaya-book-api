ALTER TABLE "pitaya"."company_contacts" ADD COLUMN "reminder_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."company_contacts" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pitaya"."company_contacts" ADD CONSTRAINT "company_contacts_reminder_token_unique" UNIQUE("reminder_token");