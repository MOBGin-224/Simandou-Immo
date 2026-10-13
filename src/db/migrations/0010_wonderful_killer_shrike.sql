ALTER TABLE "properties" ADD COLUMN "code" varchar(6);--> statement-breakpoint
WITH names AS (
  SELECT
    id,
    organization_id,
    rpad(left(regexp_replace(upper(name), '[^A-Z]', '', 'g'), 3), 3, 'X') AS base_code
  FROM properties
),
ranked AS (
  SELECT
    id,
    base_code,
    row_number() OVER (PARTITION BY organization_id, base_code ORDER BY id) AS collision_number
  FROM names
)
UPDATE properties AS property
SET code = CASE
  WHEN ranked.collision_number = 1 THEN ranked.base_code
  ELSE left(
    ranked.base_code,
    6 - length((ranked.collision_number - 1)::text)
  ) || (ranked.collision_number - 1)::text
END
FROM ranked
WHERE property.id = ranked.id;--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_org_code_unique" UNIQUE("organization_id","code");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_code_format" CHECK (code ~ '^[A-Z]{3,6}$');