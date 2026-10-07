CREATE TABLE "pitaya"."gallery_reminder_recipients" (
	"reminder_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	CONSTRAINT "gallery_reminder_recipients_reminder_id_contact_id_unique" UNIQUE("reminder_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."gallery_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_recipients" ADD CONSTRAINT "gallery_reminder_recipients_reminder_id_gallery_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "pitaya"."gallery_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminder_recipients" ADD CONSTRAINT "gallery_reminder_recipients_contact_id_company_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "pitaya"."company_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."gallery_reminders" ADD CONSTRAINT "gallery_reminders_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "pitaya"."gallery_reminders" ("gallery_id", "value", "unit")
SELECT g."id", g."reminder_value", g."reminder_unit"
FROM "pitaya"."galleries" g
WHERE g."parent_gallery_id" IS NULL
  AND (g."expires_at" IS NOT NULL OR EXISTS (
    SELECT 1 FROM "pitaya"."gallery_reminder_contacts" c WHERE c."gallery_id" = g."id"
  ));--> statement-breakpoint
INSERT INTO "pitaya"."gallery_reminder_recipients" ("reminder_id", "contact_id")
SELECT r."id", c."contact_id"
FROM "pitaya"."gallery_reminder_contacts" c
JOIN "pitaya"."gallery_reminders" r ON r."gallery_id" = c."gallery_id";--> statement-breakpoint
UPDATE "pitaya"."admin_notifications" n
SET "event_key" = 'gallery-expiry:' || n."gallery_id" || ':' || r."id" || ':' || split_part(n."event_key", ':', 3)
FROM "pitaya"."gallery_reminders" r
WHERE n."gallery_id" = r."gallery_id" AND n."kind" = 'GALLERY_EXPIRY'
  AND n."event_key" LIKE 'gallery-expiry:%';--> statement-breakpoint
UPDATE "pitaya"."gallery_reminder_deliveries" d
SET "event_key" = 'gallery-expiry:' || d."gallery_id" || ':' || r."id" || ':' || split_part(d."event_key", ':', 3)
FROM "pitaya"."gallery_reminders" r
WHERE d."gallery_id" = r."gallery_id" AND d."event_key" LIKE 'gallery-expiry:%';
