CREATE TABLE "charge_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"lease_id" uuid,
	"tenant_user_id" uuid,
	"period_start" date NOT NULL,
	"due_date" date NOT NULL,
	"amount_due" bigint NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"balance" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "receivable_status" DEFAULT 'UNPAID' NOT NULL,
	"calculation_basis" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_allocations_amount_due_non_negative" CHECK (amount_due >= 0),
	CONSTRAINT "charge_allocations_amount_paid_non_negative" CHECK (amount_paid >= 0),
	CONSTRAINT "charge_allocations_amount_paid_within_due" CHECK (amount_paid <= amount_due),
	CONSTRAINT "charge_allocations_balance_is_derived" CHECK (balance = amount_due - amount_paid),
	CONSTRAINT "charge_allocations_currency_format" CHECK (currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "charge_allocations_period_starts_month" CHECK (EXTRACT(DAY FROM period_start) = 1),
	CONSTRAINT "charge_allocations_paid_has_no_balance" CHECK (status <> 'PAID' OR balance = 0),
	CONSTRAINT "charge_allocations_unpaid_has_no_payment" CHECK (status <> 'UNPAID' OR amount_paid = 0),
	CONSTRAINT "charge_allocations_lease_and_tenant_together" CHECK ((lease_id IS NULL) = (tenant_user_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"period_start" date NOT NULL,
	"due_date" date NOT NULL,
	"total_amount" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"allocation_method" "allocation_method" DEFAULT 'EQUAL' NOT NULL,
	"status" charge_status DEFAULT 'DRAFT' NOT NULL,
	"supplier_name" varchar(120),
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_type_allowed" CHECK (type IN ('WATER', 'ELECTRICITY', 'SECURITY', 'CLEANING', 'OTHER')),
	CONSTRAINT "charges_total_amount_positive" CHECK (total_amount > 0),
	CONSTRAINT "charges_currency_format" CHECK (currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "charges_period_starts_month" CHECK (EXTRACT(DAY FROM period_start) = 1),
	CONSTRAINT "charges_due_date_after_period" CHECK (due_date >= period_start),
	CONSTRAINT "charges_supplier_name_not_blank" CHECK (supplier_name IS NULL OR length(btrim(supplier_name)) > 0),
	CONSTRAINT "charges_published_has_date" CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
	CONSTRAINT "charges_draft_has_no_published_date" CHECK (status <> 'DRAFT' OR published_at IS NULL),
	CONSTRAINT "charges_cancelled_at_matches_status" CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_allocations" ADD CONSTRAINT "charge_allocations_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charge_allocations_one_per_charge_and_apartment" ON "charge_allocations" USING btree ("charge_id","apartment_id");--> statement-breakpoint
CREATE INDEX "charge_allocations_charge_idx" ON "charge_allocations" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "charge_allocations_tenant_status_idx" ON "charge_allocations" USING btree ("tenant_user_id","status");--> statement-breakpoint
CREATE INDEX "charge_allocations_organization_due_date_idx" ON "charge_allocations" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "charge_allocations_property_status_idx" ON "charge_allocations" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "charge_allocations_apartment_idx" ON "charge_allocations" USING btree ("apartment_id");--> statement-breakpoint
CREATE INDEX "charge_allocations_status_due_date_idx" ON "charge_allocations" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "charges_property_period_idx" ON "charges" USING btree ("property_id","period_start");--> statement-breakpoint
CREATE INDEX "charges_organization_status_idx" ON "charges" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "charges_property_status_idx" ON "charges" USING btree ("property_id","status");