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

La aplicacion usa Postgres (Drizzle ORM) como unica fuente de datos. Copia
`.env.example` a `.env` y define `DATABASE_URL` y `NEXTAUTH_SECRET` antes de
iniciar.

```bash
npm install
cp .env.example .env   # completa DATABASE_URL y NEXTAUTH_SECRET
npm run db:push        # crea el esquema en la base
npm run db:seed        # carga datos iniciales (usuarios, roles, catalogos)
npm run dev
```

Usuario inicial creado por el seed:

- Correo: `admin@demo.org`
- Contrasena: valor de `DEMO_PASSWORD` (por defecto `demo-seguro`)

Todos los usuarios semilla comparten esa contrasena, almacenada con hash
bcrypt. En produccion cada usuario debe tener su propio `password_hash`.

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
