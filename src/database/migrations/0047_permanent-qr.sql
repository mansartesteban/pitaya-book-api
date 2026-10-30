CREATE TABLE "pitaya"."qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"destination" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."qr_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_id" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."qr_openings" ADD CONSTRAINT "qr_openings_qr_id_qr_codes_id_fk" FOREIGN KEY ("qr_id") REFERENCES "pitaya"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qr_openings_code_date_idx" ON "pitaya"."qr_openings" USING btree ("qr_id","opened_at");