-- Etapa 3: plan comercial y dominio propio por organizacion.
-- Migracion segura para bases con datos existentes.

-- plan: se agrega con default 'gratuito' (rellena filas existentes) y luego se
-- promueven las organizaciones YA existentes a 'institucional' para no capar de
-- golpe a los inquilinos en produccion. Los nuevos registros publicos fijan
-- 'gratuito' explicitamente desde la aplicacion.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'gratuito' NOT NULL;--> statement-breakpoint
UPDATE "organizations" SET "plan" = 'institucional' WHERE "plan" = 'gratuito';--> statement-breakpoint

-- custom_domain: dominio propio del inquilino (nullable, unico entre no-nulos).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "custom_domain" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_custom_domain_idx" ON "organizations" USING btree ("custom_domain");
