CREATE TYPE "pitaya"."client_type" AS ENUM('INDIVIDUAL', 'PROFESSIONAL', 'ASSOCIATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "pitaya"."roles" AS ENUM('USER', 'GUEST', 'CLIENT', 'ADMIN', 'SUPERADMIN');--> statement-breakpoint
CREATE TABLE "pitaya"."email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "pitaya"."email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;