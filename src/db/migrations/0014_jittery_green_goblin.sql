CREATE TABLE "lease_receipt_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_receipt_sequences_month_range" CHECK (month >= 1 AND month <= 12),
	CONSTRAINT "lease_receipt_sequences_last_value_non_negative" CHECK (last_value >= 0)
);
--> statement-breakpoint
ALTER TABLE "lease_receipt_sequences" ADD CONSTRAINT "lease_receipt_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_receipt_sequences" ADD CONSTRAINT "lease_receipt_sequences_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_receipt_sequences_property_year_month_unique" ON "lease_receipt_sequences" USING btree ("property_id","year","month");