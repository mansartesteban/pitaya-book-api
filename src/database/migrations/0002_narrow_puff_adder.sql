ALTER TABLE "pitaya"."services" ALTER COLUMN "location" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "pitaya"."companies" ADD COLUMN "userId" uuid;--> statement-breakpoint
ALTER TABLE "pitaya"."companies" ADD CONSTRAINT "companies_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;