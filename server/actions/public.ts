"use server";

import { headers } from "next/headers";
import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { publicReportSchema } from "@/lib/validators";
import { getDb } from "@/server/db";
import { writeAuditLog } from "@/server/audit/log";
import { rateLimit } from "@/lib/rate-limit";
import { getPublicSiteFromHeaders } from "@/server/queries/tenant";

type ActionResult = { ok: boolean; message: string };

// Usuario de admision del inquilino: el super_admin mas antiguo; si no hay, el
// usuario mas antiguo. El caso publico queda a su nombre para que aparezca en
// su bandeja y pueda reasignarse.
async function resolveIntakeUser(db: ReturnType<typeof getDb>, organizationId: string): Promise<string | null> {
  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(and(eq(schema.users.organizationId, organizationId), eq(schema.roles.key, "super_admin")))
    .orderBy(asc(schema.users.createdAt))
    .limit(1);
  if (admin) {
    return admin.id;
  }
  const [anyUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.organizationId, organizationId))
    .orderBy(asc(schema.users.createdAt))
    .limit(1);
  return anyUser?.id ?? null;
}

export async function submitPublicReportAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  // El inquilino se resuelve por el host (subdominio/dominio). Solo se aceptan
  // reportes si su landing esta publicada y con reportes habilitados.
  const site = await getPublicSiteFromHeaders();
  if (!site) {
    return { ok: false, message: "No se pudo identificar la organizacion." };
  }
  if (!site.landing.published || !site.landing.acceptsPublicReports) {
    return { ok: false, message: "Esta organizacion no recibe reportes en linea por ahora." };
  }

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = await rateLimit(`public-report:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return { ok: false, message: "Demasiados envios desde esta red. Intenta mas tarde." };
  }

  const parsed = publicReportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const d = parsed.data;
  const db = getDb();
  const org = site.id;

  const intakeUser = await resolveIntakeUser(db, org);
  if (!intakeUser) {
    return { ok: false, message: "La organizacion aun no tiene personal para recibir el reporte." };
  }
  const [territory] = await db
    .select({ id: schema.territories.id })
    .from(schema.territories)
    .where(eq(schema.territories.organizationId, org))
    .orderBy(asc(schema.territories.name))
    .limit(1);
  if (!territory) {
    return { ok: false, message: "La organizacion aun no configura territorios para recibir reportes." };
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.cases).where(eq(schema.cases.organizationId, org));
  const id = crypto.randomUUID();
  const caseNumber = `${site.code}-CASO-${new Date().getFullYear()}-${String(total + 1).padStart(4, "0")}`;

  await db.insert(schema.cases).values({
    id,
    organizationId: org,
    caseNumber,
    title: d.title,
    description: d.description,
    category: d.category,
    priority: "Media",
    status: "Nuevo",
    territoryId: territory.id,
    openedBy: intakeUser,
    assignedTo: intakeUser,
    openedAt: new Date(),
    incidentDate: d.incidentDate ? new Date(d.incidentDate) : null,
    incidentLocation: d.incidentLocation?.trim() || null,
    rightViolated: d.rightViolated?.trim() || null,
  });

  // Persona afectada. Si el reporte es anonimo, no se guarda nombre/contacto.
  const anonymous = d.anonymous;
  const affectedName = anonymous ? "Reservado (anonimo)" : d.affectedName?.trim() || d.reporterName?.trim() || "Reservado";
  const people: Array<typeof schema.casePeople.$inferInsert> = [
    {
      organizationId: org,
      caseId: id,
      personType: "victima",
      name: affectedName,
      contact: anonymous ? "Reservado" : d.reporterContact?.trim() || "Reservado",
      demographicData: {},
      consentStatus: "documentado",
    },
  ];
  // Solicitante: quien reporta, si dio su nombre y no es anonimo.
  if (!anonymous && d.reporterName?.trim()) {
    people.push({
      organizationId: org,
      caseId: id,
      personType: "solicitante",
      name: d.reporterName.trim(),
      contact: d.reporterContact?.trim() || "Reservado",
      demographicData: {},
      consentStatus: "documentado",
    });
  }
  await db.insert(schema.casePeople).values(people);

  await db.insert(schema.caseStatusHistory).values({
    organizationId: org,
    caseId: id,
    fromStatus: null,
    toStatus: "Nuevo",
    reason: "Reporte recibido desde el sitio publico",
    changedBy: intakeUser,
  });
  await db.insert(schema.caseNotes).values({
    organizationId: org,
    caseId: id,
    note: `Reporte publico recibido${anonymous ? " (anonimo)" : ""}. Requiere triage y validacion.`,
    createdBy: intakeUser,
  });

  await writeAuditLog({
    organizationId: org,
    action: "case.public_report",
    entityType: "case",
    entityId: id,
    after: { caseNumber, category: d.category, anonymous },
    ip: ip === "local" ? undefined : ip,
  });

  return { ok: true, message: `Reporte recibido. Tu folio es ${caseNumber}. El equipo le dara seguimiento.` };
}
