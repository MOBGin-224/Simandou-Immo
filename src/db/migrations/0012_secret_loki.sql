CREATE TABLE "payment_receipt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"generated_by_user_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replaced_at" timestamp with time zone,
	"replaced_by_user_id" uuid,
	"replacement_reason" text,
	CONSTRAINT "payment_receipt_versions_payment_version_unique" UNIQUE("payment_id","version")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "public_reference" varchar(12) NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_receipt_versions" ADD CONSTRAINT "payment_receipt_versions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipt_versions" ADD CONSTRAINT "payment_receipt_versions_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipt_versions" ADD CONSTRAINT "payment_receipt_versions_replaced_by_user_id_users_id_fk" FOREIGN KEY ("replaced_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipt_versions_one_active_per_payment" ON "payment_receipt_versions" USING btree ("payment_id") WHERE is_active = true;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_public_reference_unique" UNIQUE("public_reference");