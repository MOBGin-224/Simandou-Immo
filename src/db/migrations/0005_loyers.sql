CREATE TABLE "rent_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"due_date" date NOT NULL,
	"amount_due" bigint NOT NULL,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"balance" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "receivable_status" DEFAULT 'UNPAID' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rent_installments_period_starts_month" CHECK (EXTRACT(DAY FROM period_start) = 1),
	CONSTRAINT "rent_installments_amount_due_non_negative" CHECK (amount_due >= 0),
	CONSTRAINT "rent_installments_amount_paid_non_negative" CHECK (amount_paid >= 0),
	CONSTRAINT "rent_installments_amount_paid_within_due" CHECK (amount_paid <= amount_due),
	CONSTRAINT "rent_installments_balance_is_derived" CHECK (balance = amount_due - amount_paid),
	CONSTRAINT "rent_installments_currency_format" CHECK (currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "rent_installments_paid_has_no_balance" CHECK (status <> 'PAID' OR balance = 0),
	CONSTRAINT "rent_installments_unpaid_has_no_payment" CHECK (status <> 'UNPAID' OR amount_paid = 0)
);
--> statement-breakpoint
ALTER TABLE "rent_installments" ADD CONSTRAINT "rent_installments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_installments" ADD CONSTRAINT "rent_installments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_installments" ADD CONSTRAINT "rent_installments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_installments" ADD CONSTRAINT "rent_installments_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_installments" ADD CONSTRAINT "rent_installments_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rent_installments_one_per_lease_and_period" ON "rent_installments" USING btree ("lease_id","period_start");--> statement-breakpoint
CREATE INDEX "rent_installments_organization_status_idx" ON "rent_installments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "rent_installments_property_status_idx" ON "rent_installments" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "rent_installments_apartment_idx" ON "rent_installments" USING btree ("apartment_id");--> statement-breakpoint
CREATE INDEX "rent_installments_tenant_status_idx" ON "rent_installments" USING btree ("tenant_user_id","status");--> statement-breakpoint
CREATE INDEX "rent_installments_lease_period_idx" ON "rent_installments" USING btree ("lease_id","period_start");--> statement-breakpoint
CREATE INDEX "rent_installments_status_due_date_idx" ON "rent_installments" USING btree ("status","due_date");