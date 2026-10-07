ALTER TABLE "pitaya"."galleries" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD COLUMN "expiration_applied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "galleries_expiration_pending_idx" ON "pitaya"."galleries" ("expires_at") WHERE "expiration_applied" = false AND "expires_at" IS NOT NULL;
