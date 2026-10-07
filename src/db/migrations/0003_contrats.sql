CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"rent_amount" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"due_day" smallint NOT NULL,
	"deposit_amount" bigint DEFAULT 0 NOT NULL,
	"status" "lease_status" DEFAULT 'DRAFT' NOT NULL,
	"termination_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terminated_at" timestamp with time zone,
	CONSTRAINT "leases_rent_amount_non_negative" CHECK (rent_amount >= 0),
	CONSTRAINT "leases_deposit_amount_non_negative" CHECK (deposit_amount >= 0),
	CONSTRAINT "leases_due_day_range" CHECK (due_day BETWEEN 1 AND 31),
	CONSTRAINT "leases_end_after_start" CHECK (end_date IS NULL OR end_date >= start_date),
	CONSTRAINT "leases_currency_format" CHECK (currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "leases_terminated_at_matches_status" CHECK ((status = 'ENDED') = (terminated_at IS NOT NULL)),
	CONSTRAINT "leases_termination_reason_requires_termination" CHECK (termination_reason IS NULL OR terminated_at IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leases_one_active_per_apartment" ON "leases" USING btree ("apartment_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "leases_one_active_per_tenant_and_organization" ON "leases" USING btree ("organization_id","tenant_user_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "leases_apartment_status_idx" ON "leases" USING btree ("apartment_id","status");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX "leases_property_status_idx" ON "leases" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "leases_organization_status_idx" ON "leases" USING btree ("organization_id","status");