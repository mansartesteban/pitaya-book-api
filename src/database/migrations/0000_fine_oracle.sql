CREATE SCHEMA IF NOT EXISTS pitaya;
CREATE TYPE "pitaya"."client_type" AS ENUM('INDIVIDUAL', 'PROFESSIONAL', 'ASSOCIATION', 'OTHER');--> statement-breakpoint
CREATE TYPE "pitaya"."roles" AS ENUM('USER', 'GUEST', 'CLIENT', 'ADMIN', 'SUPERADMIN');--> statement-breakpoint
CREATE TYPE "pitaya"."company_member_role" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "pitaya"."company_member_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "pitaya"."document_type" AS ENUM('QUOTE', 'INVOICE', 'OTHER');--> statement-breakpoint
CREATE TYPE "pitaya"."gallery_visibility" AS ENUM('PUBLIC', 'PRIVATE', 'UNLISTED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "pitaya"."service_status" AS ENUM('LEAD', 'QUOTE_SENT', 'QUOTE_ACCEPTED', 'SCHEDULED', 'DONE', 'POST_PROD', 'DELIVERED', 'COMPLETED', 'DELAYED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "pitaya"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"firstname" text DEFAULT '',
	"lastname" text DEFAULT '',
	"email" text NOT NULL,
	"email_confirmed" boolean DEFAULT false,
	"phone" text DEFAULT '',
	"role" "pitaya"."roles" DEFAULT 'USER',
	"password" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"notes" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."email_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"token" varchar(1024) NOT NULL,
	"used" boolean DEFAULT false,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"siret" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "pitaya"."company_member_role" NOT NULL,
	"status" "pitaya"."company_member_status" NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_company_id_user_id_unique" UNIQUE("company_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" "pitaya"."document_type" NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" "pitaya"."gallery_visibility" NOT NULL,
	"owner_user_id" uuid,
	"owner_company_id" uuid,
	"service_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."photo_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"user_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."photo_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"user_id" uuid,
	"reaction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "photo_reactions_photo_id_user_id_reaction_unique" UNIQUE("photo_id","user_id","reaction")
);
--> statement-breakpoint
CREATE TABLE "pitaya"."photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"name" text,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitaya"."services" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"status" "pitaya"."service_status" NOT NULL,
	"price" integer,
	"description" text,
	"client_user_id" uuid,
	"client_company_id" uuid,
	"provider_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pitaya"."email_tokens" ADD CONSTRAINT "email_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "pitaya"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."company_members" ADD CONSTRAINT "company_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."documents" ADD CONSTRAINT "documents_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "pitaya"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD CONSTRAINT "galleries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "pitaya"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD CONSTRAINT "galleries_owner_company_id_companies_id_fk" FOREIGN KEY ("owner_company_id") REFERENCES "pitaya"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."galleries" ADD CONSTRAINT "galleries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "pitaya"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_comments" ADD CONSTRAINT "photo_comments_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_comments" ADD CONSTRAINT "photo_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_reactions" ADD CONSTRAINT "photo_reactions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "pitaya"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photo_reactions" ADD CONSTRAINT "photo_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."photos" ADD CONSTRAINT "photos_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "pitaya"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."services" ADD CONSTRAINT "services_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."services" ADD CONSTRAINT "services_client_company_id_companies_id_fk" FOREIGN KEY ("client_company_id") REFERENCES "pitaya"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pitaya"."services" ADD CONSTRAINT "services_provider_user_id_users_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "pitaya"."users"("id") ON DELETE set null ON UPDATE no action;