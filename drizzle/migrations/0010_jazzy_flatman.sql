-- Etapa 4: landing page publica por organizacion (contenido editable en JSON).
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "landing" jsonb;
