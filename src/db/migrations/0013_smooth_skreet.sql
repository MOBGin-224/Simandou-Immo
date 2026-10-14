CREATE TYPE "public"."lease_receipt_version_status" AS ENUM('EMISE', 'INVALIDEE');--> statement-breakpoint
CREATE TABLE "lease_receipt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_receipt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "lease_receipt_version_status" NOT NULL,
	"emitted_at" timestamp with time zone NOT NULL,
	"emitted_by_user_id" uuid,
	"invalidated_at" timestamp with time zone,
	"invalidation_reason" text,
	"invalidation_trigger_payment_id" uuid,
	"frozen_content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_receipt_versions_invalidated_requires_reason_and_date" CHECK (status <> 'INVALIDEE' OR (invalidation_reason IS NOT NULL AND invalidated_at IS NOT NULL)),
	CONSTRAINT "lease_receipt_versions_emise_has_no_invalidated_at" CHECK (status <> 'EMISE' OR invalidated_at IS NULL)
);
--> statement-breakpoint
CREATE TABLE "lease_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"reference_number" varchar(32) NOT NULL,
	"public_reference" varchar(12) NOT NULL,
	"total_attested" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_receipts_reference_number_unique" UNIQUE("reference_number"),
	CONSTRAINT "lease_receipts_public_reference_unique" UNIQUE("public_reference"),
	CONSTRAINT "lease_receipts_period_starts_month" CHECK (EXTRACT(DAY FROM period_start) = 1),
	CONSTRAINT "lease_receipts_public_reference_prefix" CHECK (public_reference LIKE 'Q-%'),
	CONSTRAINT "lease_receipts_total_attested_non_negative" CHECK (total_attested >= 0),
	CONSTRAINT "lease_receipts_currency_format" CHECK (currency ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "lease_receipt_versions" ADD CONSTRAINT "lease_receipt_versions_lease_receipt_id_lease_receipts_id_fk" FOREIGN KEY ("lease_receipt_id") REFERENCES "public"."lease_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipt_versions" ADD CONSTRAINT "lease_receipt_versions_emitted_by_user_id_users_id_fk" FOREIGN KEY ("emitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipt_versions" ADD CONSTRAINT "lease_receipt_versions_invalidation_trigger_payment_id_payments_id_fk" FOREIGN KEY ("invalidation_trigger_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipts" ADD CONSTRAINT "lease_receipts_current_version_id_lease_receipt_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."lease_receipt_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_receipt_versions_one_per_receipt_and_version" ON "lease_receipt_versions" USING btree ("lease_receipt_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_receipts_one_per_lease_and_period" ON "lease_receipts" USING btree ("lease_id","period_start");