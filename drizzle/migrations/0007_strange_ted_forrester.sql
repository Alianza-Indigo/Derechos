-- Multitenant Etapa 1: organization_id en todas las tablas de datos.
-- Migracion segura para bases con datos existentes: agrega columnas nullable,
-- rellena con la organizacion existente, y recien entonces exige NOT NULL.

-- 1) organizations: slug / code / status
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" text;--> statement-breakpoint
UPDATE "organizations" SET
  "slug" = COALESCE("slug", 'org-' || substr(replace("id"::text, '-', ''), 1, 10)),
  "code" = COALESCE("code", 'ORG-' || upper(substr(replace("id"::text, '-', ''), 1, 6)))
  WHERE "slug" IS NULL OR "code" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_code_idx" ON "organizations" USING btree ("code");--> statement-breakpoint

-- 2) organization_id en cada tabla de datos: agregar, rellenar y exigir.
DO $$
DECLARE
  t text;
  org uuid;
  tbls text[] := ARRAY[
    'users','territories','user_roles','members','member_credentials','cases',
    'case_people','case_actions','case_notes','case_status_history','case_evidence',
    'events','event_evidence','credential_verification_logs','prevalence_studies',
    'prevalence_metrics','prevalence_records','reports','field_commissions',
    'location_tracking_settings','territory_location_settings','delegate_location_pings',
    'ai_provider_configs','ai_prompt_templates','ai_conversations','ai_messages',
    'ai_runs','ai_feedback'
  ];
BEGIN
  SELECT id INTO org FROM organizations ORDER BY created_at LIMIT 1;
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id uuid', t);
    IF org IS NOT NULL THEN
      EXECUTE format('UPDATE %I SET organization_id = %L WHERE organization_id IS NULL', t, org);
    END IF;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id)',
      t, t || '_organization_id_organizations_id_fk'
    );
  END LOOP;
END $$;--> statement-breakpoint

-- audit_logs: organization_id nullable (eventos de sistema sin tenant).
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" uuid;--> statement-breakpoint
UPDATE "audit_logs" SET "organization_id" = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
  WHERE "organization_id" IS NULL AND actor_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint

-- 3) Reemplazar indices unicos globales por indices unicos por-tenant.
DROP INDEX IF EXISTS "users_email_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "members_member_number_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "cases_case_number_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_provider_configs_provider_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_prompt_templates_key_version_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "territory_location_settings_territory_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "members_member_number_idx" ON "members" USING btree ("organization_id","member_number");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_case_number_idx" ON "cases" USING btree ("organization_id","case_number");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_configs_provider_idx" ON "ai_provider_configs" USING btree ("organization_id","provider_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_templates_key_version_idx" ON "ai_prompt_templates" USING btree ("organization_id","key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "territory_location_settings_territory_idx" ON "territory_location_settings" USING btree ("organization_id","territory_id");--> statement-breakpoint

-- 4) Indices por organizacion (rendimiento).
CREATE INDEX IF NOT EXISTS "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "territories_org_idx" ON "territories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_org_idx" ON "user_roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "members_org_idx" ON "members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_credentials_org_idx" ON "member_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cases_org_idx" ON "cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_org_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prevalence_studies_org_idx" ON "prevalence_studies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prevalence_records_org_idx" ON "prevalence_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_commissions_org_idx" ON "field_commissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_tracking_settings_org_idx" ON "location_tracking_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delegate_location_pings_org_idx" ON "delegate_location_pings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_org_idx" ON "ai_conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_org_idx" ON "audit_logs" USING btree ("organization_id");
