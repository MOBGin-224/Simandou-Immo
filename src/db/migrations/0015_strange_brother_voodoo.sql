CREATE TABLE "incident_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incident_comments_content_length" CHECK (char_length(content) >= 1 AND char_length(content) <= 2000)
);
--> statement-breakpoint
CREATE TABLE "incident_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"from_status" "incident_status",
	"to_status" "incident_status" NOT NULL,
	"by_user_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"priority" "incident_priority" NOT NULL,
	"status" "incident_status" DEFAULT 'OPEN' NOT NULL,
	"category" varchar(32) NOT NULL,
	"assigned_to_user_id" uuid,
	"assigned_at" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_assignment_coherent" CHECK ((assigned_to_user_id IS NULL) = (assigned_at IS NULL) AND (assigned_to_user_id IS NULL) = (assigned_by_user_id IS NULL)),
	CONSTRAINT "incidents_assigned_requires_assignee" CHECK (status <> 'ASSIGNED' OR assigned_to_user_id IS NOT NULL),
	CONSTRAINT "incidents_closed_requires_closed_at" CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL),
	CONSTRAINT "incidents_resolved_requires_resolved_at" CHECK (status NOT IN ('RESOLVED', 'CLOSED') OR resolved_at IS NOT NULL),
	CONSTRAINT "incidents_category_valid" CHECK (category IN ('PLUMBING', 'ELECTRICITY', 'AIR_CONDITIONING', 'LOCKS_AND_KEYS', 'OTHER'))
);
--> statement-breakpoint
ALTER TABLE "incident_comments" ADD CONSTRAINT "incident_comments_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_comments" ADD CONSTRAINT "incident_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_status_history" ADD CONSTRAINT "incident_status_history_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_comments_incident_id_created_at_index" ON "incident_comments" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "incident_status_history_incident_id_created_at_index" ON "incident_status_history" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "incidents_organization_id_status_index" ON "incidents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "incidents_property_id_status_index" ON "incidents" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "incidents_assigned_to_user_id_status_index" ON "incidents" USING btree ("assigned_to_user_id","status");