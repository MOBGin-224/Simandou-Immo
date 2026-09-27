CREATE TYPE "public"."access_level" AS ENUM('MANAGE');--> statement-breakpoint
CREATE TYPE "public"."allocation_method" AS ENUM('EQUAL');--> statement-breakpoint
CREATE TYPE "public"."apartment_status" AS ENUM('VACANT', 'OCCUPIED', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."charge_status" AS ENUM('DRAFT', 'PUBLISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('RECORDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."incident_priority" AS ENUM('LOW', 'NORMAL', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."intervention_status" AS ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('IN_APP', 'SMS', 'WHATSAPP', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('INDIVIDUAL', 'COMPANY');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."receivable_status" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'MANAGER', 'TENANT');--> statement-breakpoint
CREATE TYPE "public"."user_access_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "organization_type" NOT NULL,
	"default_currency" char(3) DEFAULT 'GNF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "organizations_name_not_blank" CHECK (length(btrim(name)) > 0),
	CONSTRAINT "organizations_currency_format" CHECK (default_currency ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"phone" varchar(30),
	"email" varchar(320),
	"status" "user_status" DEFAULT 'PENDING_ACTIVATION' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_full_name_not_blank" CHECK (length(btrim(full_name)) > 0),
	CONSTRAINT "users_has_identifier" CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"number" varchar(30) NOT NULL,
	"floor" integer,
	"type" varchar(60),
	"area" numeric(10, 2),
	"status" "apartment_status" DEFAULT 'VACANT' NOT NULL,
	"reference_rent_amount" bigint,
	"currency" char(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "apartments_property_number_unique" UNIQUE("property_id","number"),
	CONSTRAINT "apartments_number_not_blank" CHECK (length(btrim(number)) > 0),
	CONSTRAINT "apartments_reference_rent_non_negative" CHECK (reference_rent_amount IS NULL OR reference_rent_amount >= 0),
	CONSTRAINT "apartments_amount_requires_currency" CHECK ((reference_rent_amount IS NULL) = (currency IS NULL)),
	CONSTRAINT "apartments_currency_format" CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "apartments_area_positive" CHECK (area IS NULL OR area > 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text,
	"city" varchar(120),
	"district" varchar(120),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "properties_org_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "properties_name_not_blank" CHECK (length(btrim(name)) > 0)
);
--> statement-breakpoint
CREATE TABLE "manager_property_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_access_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"access_level" "access_level" DEFAULT 'MANAGE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "manager_property_access_unique" UNIQUE("user_access_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "user_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"status" "user_access_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_access_user_org_role_unique" UNIQUE("user_id","organization_id","role")
);
--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_property_access" ADD CONSTRAINT "manager_property_access_user_access_id_user_access_id_fk" FOREIGN KEY ("user_access_id") REFERENCES "public"."user_access"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_property_access" ADD CONSTRAINT "manager_property_access_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access" ADD CONSTRAINT "user_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apartments_property_status_idx" ON "apartments" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "apartments_organization_idx" ON "apartments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "properties_organization_idx" ON "properties" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "manager_property_access_property_idx" ON "manager_property_access" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "user_access_user_idx" ON "user_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_access_organization_role_idx" ON "user_access" USING btree ("organization_id","role");