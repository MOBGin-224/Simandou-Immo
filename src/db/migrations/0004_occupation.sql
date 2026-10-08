ALTER TABLE "apartments" ADD COLUMN "under_maintenance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "apartments_property_maintenance_idx" ON "apartments" USING btree ("property_id","under_maintenance");--> statement-breakpoint
-- Reprise des saisies existantes (DEC-050 point 3 : preserver l'historique).
-- La colonne "status" est GELEE a partir d'ici, et volontairement conservee :
-- l'occupation se derive desormais de "leases". La seule information qu'elle
-- portait et qui reste vraie est la maintenance, qui n'est pas une occupation.
UPDATE "apartments" SET "under_maintenance" = true WHERE "status" = 'MAINTENANCE';
