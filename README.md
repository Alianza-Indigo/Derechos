# Plataforma Integral para Organizacion de Derechos Humanos

Implementacion Next.js App Router + TypeScript para Vercel, alineada al PRD IA adjunto.

## Modulos

- Auth.js con credenciales demo y callbacks para roles/territorio.
- RBAC territorial y helpers de minimizacion de datos.
- Directorio de miembros con folio institucional y QR publico seguro.
- Expedientes de casos con personas, consentimiento, timeline, evidencia y PDF.
- Eventos realizados con asistentes, instituciones, impacto y ficha.
- Operacion territorial con comisiones, mapa interno Leaflet, check-ins y retencion.
- Asistente IA con Vercel AI SDK, Gemini, ChatGPT/OpenAI y Claude/Anthropic.
- Prompts editables, versionados, activables/desactivables y probables con datos ficticios desde UI.
- Prevalencia por estudio, indicador, territorio, muestra, fuente y fecha.
- Reportes CSV/XLSX/PDF.
- Configuracion institucional, proveedores IA y auditoria.

## Desarrollo

```bash
npm install
npm run dev
```

Usuario demo:

- Correo: `admin@demo.org`
- Contrasena: `demo-seguro`

## Validaciones

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Vercel

Configura las variables de `.env.example`. La base de datos esperada es Postgres compatible con Vercel/Neon y el esquema se encuentra en `drizzle/schema.ts`.

No usa Supabase, Railway ni servidores externos propios.
