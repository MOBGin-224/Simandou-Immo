ALTER TYPE "public"."payment_status" ADD VALUE IF NOT EXISTS 'DISPUTED';
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "declared_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "validated_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "validated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "disputed_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "disputed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "dispute_reason" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "dispute_category" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "proof_url" text;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reference_number" text;
--> statement-breakpoint
UPDATE "payments"
SET "created_by" = "recorded_by_user_id"
WHERE "created_by" IS NULL AND "recorded_by_user_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_recorded_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "recorded_by_user_id";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "declared_at" SET DEFAULT now();
--> statement-breakpoint
UPDATE "payments"
SET "declared_at" = COALESCE("declared_at", "created_at")
WHERE "declared_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "declared_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments"
ADD CONSTRAINT "payments_created_by_users_id_fk"
FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments"
ADD CONSTRAINT "payments_validated_by_user_id_users_id_fk"
FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments"
ADD CONSTRAINT "payments_disputed_by_user_id_users_id_fk"
FOREIGN KEY ("disputed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
UPDATE "payments"
SET "reference_number" = CONCAT('LEGACY-', id::text)
WHERE "reference_number" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "reference_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reference_number_unique" UNIQUE("reference_number");
--> statement-breakpoint
CREATE TABLE "payment_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_sequences_property_year_unique" UNIQUE("property_id","year")
);
--> statement-breakpoint
ALTER TABLE "payment_sequences" ADD CONSTRAINT "payment_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payment_sequences" ADD CONSTRAINT "payment_sequences_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
