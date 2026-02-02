CREATE TYPE "pitaya"."client_type" AS ENUM('INDIVIDUAL', 'PROFESSIONAL', 'ASSOCIATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "pitaya"."roles" AS ENUM('USER', 'GUEST', 'CLIENT', 'ADMIN', 'SUPERADMIN');--> statement-breakpoint
CREATE TABLE "pitaya"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"firstname" text DEFAULT '',
	"lastname" text DEFAULT '',
	"email" text NOT NULL,
	"phone" text DEFAULT '',
	"email_confirmed" boolean DEFAULT false,
	"role" "pitaya"."roles" DEFAULT 'USER',
	"client_type" "pitaya"."client_type" DEFAULT 'INDIVIDUAL',
	"company_name" text,
	"password" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"notes" text
);
