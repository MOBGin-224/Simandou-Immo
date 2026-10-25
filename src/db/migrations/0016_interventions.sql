CREATE TABLE "intervention_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intervention_id" uuid NOT NULL,
	"from_status" "intervention_status",
	"to_status" "intervention_status" NOT NULL,
	"by_user_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid,
	"incident_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"provider_name" varchar(200),
	"provider_phone" varchar(30),
	"status" "intervention_status" DEFAULT 'PLANNED' NOT NULL,
	"planned_for" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"estimated_cost" bigint,
	"actual_cost" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interventions_estimated_cost_non_negative" CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
	CONSTRAINT "interventions_actual_cost_non_negative" CHECK (actual_cost IS NULL OR actual_cost >= 0),
	CONSTRAINT "interventions_completed_requires_completed_at" CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
	CONSTRAINT "interventions_completed_requires_actual_cost" CHECK (status <> 'COMPLETED' OR actual_cost IS NOT NULL),
	CONSTRAINT "interventions_cancelled_requires_cancelled_at" CHECK (status <> 'CANCELLED' OR cancelled_at IS NOT NULL),
	CONSTRAINT "interventions_in_progress_requires_started_at" CHECK (status <> 'IN_PROGRESS' OR started_at IS NOT NULL),
	CONSTRAINT "interventions_property_required_for_incident" CHECK (incident_id IS NULL OR property_id IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "intervention_status_history" ADD CONSTRAINT "intervention_status_history_intervention_id_interventions_id_fk" FOREIGN KEY ("intervention_id") REFERENCES "public"."interventions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_status_history" ADD CONSTRAINT "intervention_status_history_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intervention_status_history_intervention_id_created_at_index" ON "intervention_status_history" USING btree ("intervention_id","created_at");--> statement-breakpoint
CREATE INDEX "interventions_organization_id_status_index" ON "interventions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "interventions_property_id_status_index" ON "interventions" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "interventions_apartment_id_status_index" ON "interventions" USING btree ("apartment_id","status");--> statement-breakpoint
CREATE INDEX "interventions_incident_id_index" ON "interventions" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "interventions_assigned_to_user_id_status_index" ON "interventions" USING btree ("assigned_to_user_id","status");