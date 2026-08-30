"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { and, eq, lt, sql, type SQL } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { runAssistant } from "@/lib/ai/adapters";
import { normalizeSearch } from "@/lib/utils";
import { planCapacityError } from "@/server/permissions/plan";
import { createNotification } from "@/server/notify/create";
import {
  aiFeedbackSchema,
  aiRunSchema,
  caseIntakeSchema,
  credentialActionSchema,
  locationPurgeSchema,
  casePersonSchema,
  caseStatusUpdateSchema,
  caseTimelineActionSchema,
  checkInSchema,
  commissionFormSchema,
  evidenceFormSchema,
  eventFormSchema,
  caseReassignSchema,
  locationPauseSchema,
  locationSettingSchema,
  memberAccessSchema,
  memberDeleteSchema,
  memberFormSchema,
  memberPhotoSchema,
  memberPositionSchema,
  memberProfileSchema,
  memberReportSchema,
  memberStatusSchema,
  metricSchema,
  organizationSchema,
  prevalenceRecordSchema,
  roleAssignmentSchema,
  roleRemovalSchema,
  studySchema,
  territoryLocationSchema,
  providerConfigSchema,
  promptTemplateSchema,
  landingSchema,
  userFormSchema,
  userStatusSchema,
} from "@/lib/validators";
import { normalizeLanding, type LandingContent } from "@/lib/landing";
import { writeAuditLog } from "@/server/audit/log";
import { getDb } from "@/server/db";
import { canAccessTerritory, hasAnyPermission } from "@/server/permissions/rbac";
import { getCaseById, getCommissionById, getCurrentUser, getEventById, getMemberById, getMemberSelf } from "@/server/queries/app";
import type { User } from "@/lib/types";

type ActionResult = {
  ok: boolean;
  message: string;
  output?: string;
  runId?: string;
};

const DENIED: ActionResult = { ok: false, message: "No tienes permiso para realizar esta accion." };

function can(user: User, permissions: string[]) {
  return hasAnyPermission(user, permissions);
}

// Codigo corto de la organizacion (tenant) para los folios.
async function orgCode(db: ReturnType<typeof getDb>, organizationId: string) {
  const [org] = await db.select({ code: schema.organizations.code }).from(schema.organizations).where(eq(schema.organizations.id, organizationId)).limit(1);
  return org?.code ?? "ORG";
}

// Verifica que los IDs referenciados en una accion pertenezcan a la
// organizacion del actor. Evita que una request fabricada enlace datos de
// otro tenant (territorios, usuarios, comisiones, estudios, indicadores).
async function orgRefError(
  db: ReturnType<typeof getDb>,
  org: string,
  refs: { territoryId?: string | null; userId?: string | null; commissionId?: string | null; studyId?: string | null; metricId?: string | null },
): Promise<string | null> {
  if (refs.territoryId) {
    const [row] = await db.select({ id: schema.territories.id }).from(schema.territories).where(and(eq(schema.territories.id, refs.territoryId), eq(schema.territories.organizationId, org))).limit(1);
    if (!row) return "El territorio seleccionado no pertenece a tu organizacion.";
  }
  if (refs.userId) {
    const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.id, refs.userId), eq(schema.users.organizationId, org))).limit(1);
    if (!row) return "El usuario seleccionado no pertenece a tu organizacion.";
  }
  if (refs.commissionId) {
    const [row] = await db.select({ id: schema.fieldCommissions.id }).from(schema.fieldCommissions).where(and(eq(schema.fieldCommissions.id, refs.commissionId), eq(schema.fieldCommissions.organizationId, org))).limit(1);
    if (!row) return "La comision seleccionada no pertenece a tu organizacion.";
  }
  if (refs.studyId) {
    const [row] = await db.select({ id: schema.prevalenceStudies.id }).from(schema.prevalenceStudies).where(and(eq(schema.prevalenceStudies.id, refs.studyId), eq(schema.prevalenceStudies.organizationId, org))).limit(1);
    if (!row) return "El estudio seleccionado no pertenece a tu organizacion.";
  }
  if (refs.metricId) {
    const [row] = await db.select({ id: schema.prevalenceMetrics.id }).from(schema.prevalenceMetrics).where(and(eq(schema.prevalenceMetrics.id, refs.metricId), eq(schema.prevalenceMetrics.organizationId, org))).limit(1);
    if (!row) return "El indicador seleccionado no pertenece a tu organizacion.";
  }
  return null;
}

// --------------------------------------------------------------------------
// Miembros
// --------------------------------------------------------------------------
export async function createMemberAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "write:limited"])) {
    return DENIED;
  }
  const parsed = memberFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  if (!canAccessTerritory(user, parsed.data.territoryId)) {
    return { ok: false, message: "No puedes registrar miembros fuera de tu territorio." };
  }

  const db = getDb();
  const org = user.organizationId;
  const refError = await orgRefError(db, org, { territoryId: parsed.data.territoryId });
  if (refError) {
    return { ok: false, message: refError };
  }
  const overCapacity = await planCapacityError(org, "members");
  if (overCapacity) {
    return { ok: false, message: overCapacity };
  }
  const duplicate = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(and(eq(schema.members.organizationId, org), sql`(${schema.members.email} = ${parsed.data.email} or ${schema.members.phone} = ${parsed.data.phone})`))
    .limit(1);
  if (duplicate.length) {
    return { ok: false, message: "Ya existe un miembro con ese correo o telefono." };
  }
  // Deteccion de posible duplicado por nombre similar en el mismo territorio.
  const territoryMembers = await db
    .select({ fullName: schema.members.fullName })
    .from(schema.members)
    .where(and(eq(schema.members.organizationId, org), eq(schema.members.territoryId, parsed.data.territoryId)));
  const normalizedNew = normalizeSearch(parsed.data.fullName);
  if (territoryMembers.some((member) => normalizeSearch(member.fullName) === normalizedNew)) {
    return { ok: false, message: "Ya existe un miembro con un nombre muy similar en ese territorio. Verifica posibles duplicados." };
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.members).where(eq(schema.members.organizationId, org));
  const id = crypto.randomUUID();
  const slug = `credencial-${crypto.randomUUID().slice(0, 8)}`;
  const memberNumber = `${await orgCode(db, org)}-${String(total + 1).padStart(6, "0")}`;
  await db.insert(schema.members).values({
    id,
    organizationId: org,
    memberNumber,
    fullName: parsed.data.fullName,
    birthDate: new Date(parsed.data.birthDate),
    gender: parsed.data.gender,
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
    position: parsed.data.position || null,
    territoryId: parsed.data.territoryId,
    status: parsed.data.status,
    joinedAt: new Date(),
  });
  await db.insert(schema.memberCredentials).values({
    organizationId: org,
    memberId: id,
    qrToken: crypto.randomUUID(),
    publicSlug: slug,
    expiresAt: new Date(nextYear()),
    status: parsed.data.status === "activo" ? "activa" : "suspendida",
  });
  await writeAuditLog({ actorId: user.id, action: "member.create", entityType: "member", entityId: id, after: { ...parsed.data, memberNumber } });
  await writeAuditLog({ actorId: user.id, action: "credential.issue", entityType: "member_credential", entityId: slug, after: { publicSlug: slug } });
  redirect(`/miembros/${id}`);
}

// Asigna o actualiza el puesto/cargo del miembro dentro de la organizacion.
export async function updateMemberPositionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "*"])) {
    return DENIED;
  }
  const parsed = memberPositionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const member = await getMemberById(parsed.data.memberId);
  if (!member) {
    return { ok: false, message: "No tienes acceso a este miembro." };
  }
  const db = getDb();
  const position = parsed.data.position?.trim() || null;
  await db.update(schema.members).set({ position, updatedAt: new Date() }).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, user.organizationId)));
  await writeAuditLog({ actorId: user.id, action: "member.position_update", entityType: "member", entityId: parsed.data.memberId, after: { position } });
  revalidatePath(`/miembros/${parsed.data.memberId}`);
  revalidatePath("/miembros");
  return { ok: true, message: "Puesto actualizado." };
}

// Baja logica / reactivacion de un miembro. Al dar de baja se revoca la
// credencial y se desactiva la cuenta del portal; al reactivar se restablecen.
export async function setMemberStatusAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "*"])) {
    return DENIED;
  }
  const parsed = memberStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const member = await getMemberById(parsed.data.memberId);
  if (!member) {
    return { ok: false, message: "No tienes acceso a este miembro." };
  }
  const db = getDb();
  const org = user.organizationId;
  const [record] = await db.select().from(schema.members).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, org))).limit(1);
  await db.update(schema.members).set({ status: parsed.data.status, updatedAt: new Date() }).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, org)));

  if (parsed.data.status === "baja" || parsed.data.status === "fallecido") {
    await db.update(schema.memberCredentials).set({ status: "revocada" }).where(and(eq(schema.memberCredentials.memberId, parsed.data.memberId), eq(schema.memberCredentials.organizationId, org)));
    if (record.userId) {
      await db.update(schema.users).set({ status: "disabled", updatedAt: new Date() }).where(and(eq(schema.users.id, record.userId), eq(schema.users.organizationId, org)));
    }
  } else if (parsed.data.status === "activo") {
    await db.update(schema.memberCredentials).set({ status: "activa" }).where(and(eq(schema.memberCredentials.memberId, parsed.data.memberId), eq(schema.memberCredentials.organizationId, org)));
    if (record.userId) {
      await db.update(schema.users).set({ status: "active", updatedAt: new Date() }).where(and(eq(schema.users.id, record.userId), eq(schema.users.organizationId, org)));
    }
  }
  await writeAuditLog({ actorId: user.id, action: "member.status_change", entityType: "member", entityId: parsed.data.memberId, before: { status: record.status }, after: { status: parsed.data.status } });
  revalidatePath(`/miembros/${parsed.data.memberId}`);
  revalidatePath("/miembros");
  return { ok: true, message: parsed.data.status === "baja" ? "Miembro dado de baja (credencial revocada y acceso desactivado)." : "Estado del miembro actualizado." };
}

// Borrado definitivo, solo super_admin y solo si el miembro no tiene cuenta de
// portal ligada (lo que implica que no tiene casos abiertos a su nombre).
export async function deleteMemberAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["*"])) {
    return { ok: false, message: "Solo un super administrador puede eliminar miembros de forma definitiva." };
  }
  const parsed = memberDeleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Escribe ELIMINAR para confirmar el borrado definitivo." };
  }
  const db = getDb();
  const org = user.organizationId;
  const [record] = await db.select().from(schema.members).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, org))).limit(1);
  if (!record) {
    return { ok: false, message: "El miembro no existe." };
  }
  if (record.userId) {
    return { ok: false, message: "Este miembro tiene cuenta de portal e historial ligado. Da de baja en lugar de eliminar." };
  }
  const credentials = await db.select({ id: schema.memberCredentials.id }).from(schema.memberCredentials).where(and(eq(schema.memberCredentials.memberId, parsed.data.memberId), eq(schema.memberCredentials.organizationId, org)));
  for (const credential of credentials) {
    await db.delete(schema.credentialVerificationLogs).where(eq(schema.credentialVerificationLogs.credentialId, credential.id));
  }
  await db.delete(schema.memberCredentials).where(and(eq(schema.memberCredentials.memberId, parsed.data.memberId), eq(schema.memberCredentials.organizationId, org)));
  await db.delete(schema.members).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, org)));
  await writeAuditLog({ actorId: user.id, action: "member.delete", entityType: "member", entityId: parsed.data.memberId, before: { memberNumber: record.memberNumber, fullName: record.fullName } });
  redirect("/miembros");
}

// --------------------------------------------------------------------------
// Casos
// --------------------------------------------------------------------------
export async function createCaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  // Disponible para todos los colaboradores (cualquier rol de personal con
  // capacidad de captura); los miembros usan el portal y los auditores solo
  // leen.
  if (!can(user, ["write:case", "write:territory", "write:field", "write:event", "write:limited", "read:national", "*"])) {
    return DENIED;
  }
  const parsed = caseIntakeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const d = parsed.data;

  const db = getDb();
  const org = user.organizationId;
  const overCapacity = await planCapacityError(org, "cases");
  if (overCapacity) {
    return { ok: false, message: overCapacity };
  }
  const refError = await orgRefError(db, org, { territoryId: d.territoryId, userId: d.assignedTo });
  if (refError) {
    return { ok: false, message: refError };
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.cases).where(eq(schema.cases.organizationId, org));
  const id = crypto.randomUUID();
  const caseNumber = `${await orgCode(db, org)}-CASO-${new Date().getFullYear()}-${String(total + 1).padStart(4, "0")}`;
  await db.insert(schema.cases).values({
    id,
    organizationId: org,
    caseNumber,
    title: d.title,
    description: d.description,
    category: d.category,
    priority: d.priority,
    status: d.status,
    territoryId: d.territoryId,
    openedBy: user.id,
    assignedTo: d.assignedTo,
    openedAt: new Date(),
    incidentDate: d.incidentDate ? new Date(d.incidentDate) : null,
    incidentLocation: d.incidentLocation || null,
    rightViolated: d.rightViolated || null,
  });

  // Persona afectada (victima)
  const people: Array<typeof schema.casePeople.$inferInsert> = [
    {
      organizationId: org,
      caseId: id,
      personType: "victima",
      name: d.victimName,
      contact: d.victimContact?.trim() || "Reservado",
      demographicData: {
        ...(d.victimGender ? { genero: d.victimGender } : {}),
        ...(d.victimAgeGroup ? { grupoEdad: d.victimAgeGroup } : {}),
      },
      consentStatus: d.consentStatus,
    },
  ];
  // Quien reporta, si es distinto de la persona afectada
  if (d.reporterName?.trim()) {
    people.push({
      organizationId: org,
      caseId: id,
      personType: "solicitante",
      name: d.reporterName.trim(),
      contact: d.reporterContact?.trim() || "Reservado",
      demographicData: d.reporterRelation ? { relacion: d.reporterRelation } : {},
      consentStatus: d.consentStatus,
    });
  }
  // Autoridad o institucion senalada
  if (d.authorityName?.trim()) {
    people.push({
      organizationId: org,
      caseId: id,
      personType: "autoridad",
      name: d.authorityName.trim(),
      contact: "N/A",
      demographicData: {},
      consentStatus: "no_aplica",
    });
  }
  await db.insert(schema.casePeople).values(people);

  await db.insert(schema.caseStatusHistory).values({
    organizationId: org,
    caseId: id,
    fromStatus: null,
    toStatus: d.status,
    reason: "Alta inicial del caso",
    changedBy: user.id,
  });
  await db.insert(schema.caseNotes).values({
    organizationId: org,
    caseId: id,
    note: "Caso creado desde el formato de admision.",
    createdBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "case.create", entityType: "case", entityId: id, after: { caseNumber, category: d.category, priority: d.priority } });
  redirect(`/casos/${id}`);
}

export async function updateCaseStatusAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:territory"])) {
    return DENIED;
  }
  const parsed = caseStatusUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Cambio invalido." };
  }
  const db = getDb();
  const [current] = await db.select().from(schema.cases).where(and(eq(schema.cases.id, parsed.data.caseId), eq(schema.cases.organizationId, user.organizationId))).limit(1);
  if (!current) {
    return { ok: false, message: "Caso no encontrado." };
  }
  if (!(canAccessTerritory(user, current.territoryId) || current.assignedTo === user.id || current.openedBy === user.id)) {
    return { ok: false, message: "No tienes acceso a este caso." };
  }
  await db.update(schema.cases).set({
    status: parsed.data.status,
    closedAt: ["Resuelto", "Cerrado sin accion", "Archivado"].includes(parsed.data.status) ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(schema.cases.id, parsed.data.caseId), eq(schema.cases.organizationId, user.organizationId)));
  await db.insert(schema.caseStatusHistory).values({
    organizationId: user.organizationId,
    caseId: parsed.data.caseId,
    fromStatus: current.status,
    toStatus: parsed.data.status,
    reason: parsed.data.reason,
    changedBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "case.status_change", entityType: "case", entityId: parsed.data.caseId, before: { status: current.status }, after: parsed.data });
  revalidatePath(`/casos/${parsed.data.caseId}`);
  return { ok: true, message: "Estado actualizado con motivo y auditoria." };
}

export async function addEvidenceAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:event", "write:territory"])) {
    return DENIED;
  }
  const parsed = evidenceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Evidencia invalida." };
  }
  const db = getDb();
  if (parsed.data.entityType === "case") {
    const [current] = await db.select().from(schema.cases).where(and(eq(schema.cases.id, parsed.data.entityId), eq(schema.cases.organizationId, user.organizationId))).limit(1);
    if (!current || !(canAccessTerritory(user, current.territoryId) || current.assignedTo === user.id || current.openedBy === user.id)) {
      return { ok: false, message: "Caso no encontrado o sin acceso." };
    }
    const id = crypto.randomUUID();
    await db.insert(schema.caseEvidence).values({
      id,
      organizationId: user.organizationId,
      caseId: parsed.data.entityId,
      fileUrl: parsed.data.fileUrl,
      fileType: parsed.data.fileType,
      description: parsed.data.description,
      uploadedBy: user.id,
    });
    await writeAuditLog({ actorId: user.id, action: "evidence.upload", entityType: "case_evidence", entityId: id, after: parsed.data });
    revalidatePath(`/casos/${parsed.data.entityId}`);
    return { ok: true, message: "Evidencia protegida registrada." };
  }
  const [current] = await db.select().from(schema.events).where(and(eq(schema.events.id, parsed.data.entityId), eq(schema.events.organizationId, user.organizationId))).limit(1);
  if (!current || !canAccessTerritory(user, current.territoryId)) {
    return { ok: false, message: "Evento no encontrado o sin acceso." };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.eventEvidence).values({
    id,
    organizationId: user.organizationId,
    eventId: parsed.data.entityId,
    fileUrl: parsed.data.fileUrl,
    type: parsed.data.fileType,
    description: parsed.data.description,
  });
  await writeAuditLog({ actorId: user.id, action: "evidence.upload", entityType: "event_evidence", entityId: id, after: parsed.data });
  revalidatePath(`/eventos/${parsed.data.entityId}`);
  return { ok: true, message: "Evidencia de evento registrada." };
}

async function assertCaseAccess(userId: string, organizationId: string, canTerritory: (t: string) => boolean, caseId: string) {
  const db = getDb();
  const [record] = await db.select().from(schema.cases).where(and(eq(schema.cases.id, caseId), eq(schema.cases.organizationId, organizationId))).limit(1);
  if (!record) {
    return null;
  }
  return canTerritory(record.territoryId) || record.assignedTo === userId || record.openedBy === userId ? record : null;
}

export async function addCasePersonAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:territory"])) {
    return DENIED;
  }
  const parsed = casePersonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const record = await assertCaseAccess(user.id, user.organizationId, (t) => canAccessTerritory(user, t), parsed.data.caseId);
  if (!record) {
    return { ok: false, message: "Caso no encontrado o sin acceso." };
  }
  const db = getDb();
  await db.insert(schema.casePeople).values({
    organizationId: user.organizationId,
    caseId: parsed.data.caseId,
    personType: parsed.data.personType,
    name: parsed.data.name,
    contact: parsed.data.contact,
    demographicData: {},
    consentStatus: parsed.data.consentStatus,
  });
  await writeAuditLog({ actorId: user.id, action: "case.person_add", entityType: "case", entityId: parsed.data.caseId, after: { personType: parsed.data.personType, consentStatus: parsed.data.consentStatus } });
  revalidatePath(`/casos/${parsed.data.caseId}`);
  return { ok: true, message: "Persona agregada al expediente." };
}

export async function addCaseActionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:territory"])) {
    return DENIED;
  }
  const parsed = caseTimelineActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const record = await assertCaseAccess(user.id, user.organizationId, (t) => canAccessTerritory(user, t), parsed.data.caseId);
  if (!record) {
    return { ok: false, message: "Caso no encontrado o sin acceso." };
  }
  const db = getDb();
  await db.insert(schema.caseActions).values({
    organizationId: user.organizationId,
    caseId: parsed.data.caseId,
    actionType: parsed.data.actionType,
    description: parsed.data.description,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    createdBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "case.action_add", entityType: "case", entityId: parsed.data.caseId, after: { actionType: parsed.data.actionType } });
  revalidatePath(`/casos/${parsed.data.caseId}`);
  return { ok: true, message: "Accion agregada al timeline." };
}

// --------------------------------------------------------------------------
// Eventos
// --------------------------------------------------------------------------
export async function createEventAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:event", "write:territory"])) {
    return DENIED;
  }
  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { territoryId: parsed.data.territoryId });
  if (refError) {
    return { ok: false, message: refError };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.events).values({
    id,
    organizationId: user.organizationId,
    title: parsed.data.title,
    description: parsed.data.description,
    eventType: parsed.data.eventType,
    dateStart: new Date(parsed.data.dateStart),
    dateEnd: new Date(parsed.data.dateEnd),
    location: parsed.data.location,
    objective: parsed.data.objective || null,
    territoryId: parsed.data.territoryId,
    organizerId: user.id,
    attendeesCount: parsed.data.attendeesCount,
    institutions: parsed.data.institutions,
    impactSummary: parsed.data.impactSummary,
    indicators: parsed.data.indicators.length ? parsed.data.indicators : ["Personas atendidas"],
  });
  await writeAuditLog({ actorId: user.id, action: "event.create", entityType: "event", entityId: id, after: parsed.data });
  redirect(`/eventos/${id}`);
}

// --------------------------------------------------------------------------
// Comisiones y check-ins
// --------------------------------------------------------------------------
export async function createCommissionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:field", "write:territory"])) {
    return DENIED;
  }
  const parsed = commissionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { territoryId: parsed.data.territoryId, userId: parsed.data.assignedTo });
  if (refError) {
    return { ok: false, message: refError };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.fieldCommissions).values({
    id,
    organizationId: user.organizationId,
    title: parsed.data.title,
    commissionType: parsed.data.commissionType,
    description: parsed.data.description,
    assignedTo: parsed.data.assignedTo,
    territoryId: parsed.data.territoryId,
    status: "programada",
    scheduledAt: new Date(parsed.data.scheduledAt),
  });
  await writeAuditLog({ actorId: user.id, action: "commission.assign", entityType: "field_commission", entityId: id, after: parsed.data });
  redirect(`/operacion-territorial/comisiones/${id}`);
}

export async function createCheckInAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["location:checkin", "write:field"])) {
    return DENIED;
  }
  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Ubicacion invalida." };
  }

  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { territoryId: parsed.data.territoryId, commissionId: parsed.data.fieldCommissionId || null });
  if (refError) {
    return { ok: false, message: refError };
  }
  const [setting] = await db.select().from(schema.locationTrackingSettings).where(eq(schema.locationTrackingSettings.userId, user.id)).limit(1);
  if (setting && !setting.enabled) {
    return { ok: false, message: "La geolocalizacion esta deshabilitada o pausada para este usuario." };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.delegateLocationPings).values({
    id,
    organizationId: user.organizationId,
    userId: user.id,
    fieldCommissionId: parsed.data.fieldCommissionId || null,
    territoryId: parsed.data.territoryId,
    latitude: String(parsed.data.latitude),
    longitude: String(parsed.data.longitude),
    accuracyMeters: parsed.data.accuracyMeters,
    captureMode: parsed.data.captureMode,
    batteryLevel: parsed.data.batteryLevel,
    status: parsed.data.captureMode === "commission" ? "en_comision" : "disponible",
    capturedAt: new Date(),
  });
  await writeAuditLog({ actorId: user.id, action: "geolocation.check_in", entityType: "delegate_location_ping", entityId: id, after: { ...parsed.data, latitude: "redacted", longitude: "redacted" } });
  revalidatePath("/operacion-territorial/geolocalizacion");
  return { ok: true, message: "Check-in registrado con ubicacion autorizada y auditoria." };
}

// El propio delegado/comisionado pausa o reactiva su ubicacion, con motivo.
export async function setOwnLocationStateAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["location:checkin", "write:field"])) {
    return DENIED;
  }
  const parsed = locationPauseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const reason = parsed.data.reason?.trim();
  if (parsed.data.paused && !reason) {
    return { ok: false, message: "Captura el motivo para pausar tu ubicacion." };
  }
  const db = getDb();
  const [existing] = await db.select().from(schema.locationTrackingSettings).where(eq(schema.locationTrackingSettings.userId, user.id)).limit(1);
  if (existing) {
    await db.update(schema.locationTrackingSettings).set({
      enabled: !parsed.data.paused,
      disabledReason: parsed.data.paused ? reason : null,
      updatedBy: user.id,
      updatedAt: new Date(),
    }).where(eq(schema.locationTrackingSettings.id, existing.id));
  } else {
    await db.insert(schema.locationTrackingSettings).values({
      organizationId: user.organizationId,
      userId: user.id,
      enabled: !parsed.data.paused,
      disabledReason: parsed.data.paused ? reason : null,
      updatedBy: user.id,
    });
  }
  await writeAuditLog({
    actorId: user.id,
    action: parsed.data.paused ? "geolocation.pause" : "geolocation.resume",
    entityType: "location_tracking_setting",
    entityId: user.id,
    after: { paused: parsed.data.paused, reason: parsed.data.paused ? reason : null },
  });
  revalidatePath("/operacion-territorial/geolocalizacion");
  return { ok: true, message: parsed.data.paused ? "Ubicacion pausada con motivo registrado." : "Ubicacion reactivada." };
}

// --------------------------------------------------------------------------
// Asistente IA
// --------------------------------------------------------------------------
export async function runAssistantAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:use", "ai:admin"])) {
    return DENIED;
  }
  const parsed = aiRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud invalida." };
  }
  const db = getDb();
  const [row] = await db.select().from(schema.aiPromptTemplates).where(and(eq(schema.aiPromptTemplates.id, parsed.data.promptTemplateId), eq(schema.aiPromptTemplates.organizationId, user.organizationId))).limit(1);
  if (!row || !row.enabled) {
    return { ok: false, message: "El prompt no existe o esta desactivado." };
  }
  const prompt = {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    moduleScope: row.moduleScope,
    systemPrompt: row.systemPrompt,
    userPromptTemplate: row.userPromptTemplate,
    variables: row.variables,
    providerKey: row.providerKey,
    model: row.model ?? undefined,
    temperature: Number(row.temperature),
    enabled: row.enabled,
    version: row.version,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };

  // Contexto permitido por rol y territorio: se inyecta el contenido real de la
  // entidad relacionada (caso/evento/comision). getCaseById/getEventById/
  // getCommissionById ya aplican el control de acceso; si el usuario no puede
  // acceder, se rechaza la solicitud en vez de filtrar datos.
  const context: Record<string, unknown> = {
    usuario: user.name,
    rol: user.roles.join(", "),
    territorio: user.territoryId,
  };
  if (parsed.data.relatedCaseId) {
    const record = await getCaseById(parsed.data.relatedCaseId);
    if (!record) {
      return { ok: false, message: "No tienes acceso al caso relacionado." };
    }
    context.caso = {
      numero: record.caseNumber,
      titulo: record.title,
      categoria: record.category,
      prioridad: record.priority,
      estado: record.status,
      descripcion: record.description,
      acciones: record.actions.map((action) => ({ tipo: action.actionType, descripcion: action.description, vence: action.dueDate })),
      personas: record.persons.map((person) => ({ tipo: person.personType, consentimiento: person.consentStatus })),
    };
  }
  if (parsed.data.relatedEventId) {
    const record = await getEventById(parsed.data.relatedEventId);
    if (!record) {
      return { ok: false, message: "No tienes acceso al evento relacionado." };
    }
    context.evento = {
      titulo: record.title,
      tipo: record.eventType,
      objetivo: record.objective,
      instituciones: record.institutions,
      indicadores: record.indicators,
      resumen: record.impactSummary,
    };
  }
  if (parsed.data.fieldCommissionId) {
    const record = await getCommissionById(parsed.data.fieldCommissionId);
    if (!record) {
      return { ok: false, message: "No tienes acceso a la comision relacionada." };
    }
    context.comision = {
      titulo: record.title,
      tipo: record.commissionType,
      estado: record.status,
      descripcion: record.description,
      programada: record.scheduledAt,
    };
  }

  const result = await runAssistant({ prompt, message: parsed.data.message, context, organizationId: user.organizationId });

  await writeAuditLog({
    actorId: user.id,
    action: "ai.run",
    entityType: "ai_prompt_template",
    entityId: prompt.id,
    after: { provider: result.provider, model: result.model, status: result.status },
  });

  // Un proveedor deshabilitado no genera conversacion: se informa el error claro.
  if (result.status === "disabled") {
    return { ok: false, message: result.output };
  }

  const conversationId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const org = user.organizationId;
  await db.insert(schema.aiConversations).values({
    id: conversationId,
    organizationId: org,
    userId: user.id,
    relatedCaseId: parsed.data.relatedCaseId || null,
    relatedEventId: parsed.data.relatedEventId || null,
    fieldCommissionId: parsed.data.fieldCommissionId || null,
    promptTemplateId: prompt.id,
    title: prompt.name,
    status: "activa",
  });
  await db.insert(schema.aiMessages).values([
    { organizationId: org, conversationId, role: "user", content: parsed.data.message, metadata: {} },
    { organizationId: org, conversationId, role: "assistant", content: result.output, metadata: { provider: result.provider, model: result.model } },
  ]);
  await db.insert(schema.aiRuns).values({
    id: runId,
    organizationId: org,
    conversationId,
    promptTemplateId: prompt.id,
    input: { message: parsed.data.message },
    outputText: result.output,
    model: result.model,
    tokenUsage: result.tokenUsage,
    status: result.status,
  });

  const note = result.status === "simulated" ? " (modo local sin credenciales)" : result.status === "blocked" ? " (bloqueado por politica)" : "";
  return { ok: true, message: `Respuesta generada con ${result.provider}/${result.model}${note}.`, output: result.output, runId };
}

export async function submitAiFeedbackAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:use", "ai:admin"])) {
    return DENIED;
  }
  const parsed = aiFeedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Calificacion invalida." };
  }
  const db = getDb();
  const [run] = await db.select({ id: schema.aiRuns.id }).from(schema.aiRuns).where(and(eq(schema.aiRuns.id, parsed.data.aiRunId), eq(schema.aiRuns.organizationId, user.organizationId))).limit(1);
  if (!run) {
    return { ok: false, message: "No se encontro la respuesta a calificar." };
  }
  await db.insert(schema.aiFeedback).values({
    organizationId: user.organizationId,
    aiRunId: parsed.data.aiRunId,
    userId: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });
  await writeAuditLog({ actorId: user.id, action: "ai.feedback", entityType: "ai_run", entityId: parsed.data.aiRunId, after: { rating: parsed.data.rating } });
  return { ok: true, message: "Gracias, tu calificacion quedo registrada." };
}

export async function savePromptAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:admin", "write:config"])) {
    return DENIED;
  }
  const parsed = promptTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Prompt invalido." };
  }

  const db = getDb();
  const org = user.organizationId;
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(and(eq(schema.aiPromptTemplates.organizationId, org), eq(schema.aiPromptTemplates.key, parsed.data.key)));
  const id = crypto.randomUUID();
  await db.insert(schema.aiPromptTemplates).values({
    id,
    organizationId: org,
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description,
    moduleScope: parsed.data.moduleScope,
    systemPrompt: parsed.data.systemPrompt,
    userPromptTemplate: parsed.data.userPromptTemplate,
    variables: parsed.data.variables,
    providerKey: parsed.data.providerKey,
    model: parsed.data.model,
    temperature: String(parsed.data.temperature),
    enabled: parsed.data.enabled,
    version,
    updatedBy: user.id,
    updatedAt: new Date(),
  });
  await writeAuditLog({ actorId: user.id, action: "ai.prompt_update", entityType: "ai_prompt_template", entityId: id, after: parsed.data });
  redirect("/asistente/prompts");
}

export async function updateProviderConfigAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:admin", "write:config"])) {
    return DENIED;
  }
  const parsed = providerConfigSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Proveedor invalido." };
  }
  const db = getDb();
  const apiKey = parsed.data.apiKey?.trim();
  await db.update(schema.aiProviderConfigs).set({
    enabled: parsed.data.enabled,
    defaultModel: parsed.data.defaultModel,
    priority: parsed.data.priority,
    ...(apiKey ? { apiKey } : {}),
    updatedBy: user.id,
    updatedAt: new Date(),
  }).where(and(eq(schema.aiProviderConfigs.organizationId, user.organizationId), eq(schema.aiProviderConfigs.providerKey, parsed.data.providerKey)));
  await writeAuditLog({ actorId: user.id, action: "provider.update", entityType: "ai_provider_config", entityId: parsed.data.providerKey, after: { enabled: parsed.data.enabled, defaultModel: parsed.data.defaultModel, priority: parsed.data.priority, apiKeyChanged: Boolean(apiKey) } });
  revalidatePath("/asistente/proveedores");
  return { ok: true, message: "Proveedor actualizado y auditado." };
}

// --------------------------------------------------------------------------
// Prevalencia
// --------------------------------------------------------------------------
export async function createPrevalenceRecordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "write:limited"])) {
    return DENIED;
  }
  const parsed = prevalenceRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Medicion invalida." };
  }
  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { studyId: parsed.data.studyId, metricId: parsed.data.metricId, territoryId: parsed.data.territoryId });
  if (refError) {
    return { ok: false, message: refError };
  }
  // El indicador debe pertenecer al estudio indicado (coherencia intra-tenant).
  const [metric] = await db.select({ studyId: schema.prevalenceMetrics.studyId }).from(schema.prevalenceMetrics).where(eq(schema.prevalenceMetrics.id, parsed.data.metricId)).limit(1);
  if (!metric || metric.studyId !== parsed.data.studyId) {
    return { ok: false, message: "El indicador no pertenece al estudio seleccionado." };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.prevalenceRecords).values({
    id,
    organizationId: user.organizationId,
    studyId: parsed.data.studyId,
    metricId: parsed.data.metricId,
    territoryId: parsed.data.territoryId,
    valueNumeric: parsed.data.valueNumeric === undefined ? null : String(parsed.data.valueNumeric),
    valueText: parsed.data.valueText,
    sampleSize: parsed.data.sampleSize,
    source: parsed.data.source,
    measuredAt: new Date(parsed.data.measuredAt),
  });
  await writeAuditLog({ actorId: user.id, action: "prevalence.record_create", entityType: "prevalence_record", entityId: id, after: parsed.data });
  revalidatePath("/prevalencia");
  return { ok: true, message: "Medicion guardada." };
}

export async function createStudyAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "write:config"])) {
    return DENIED;
  }
  const parsed = studySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const [inserted] = await db.insert(schema.prevalenceStudies).values({
    organizationId: user.organizationId,
    name: parsed.data.name,
    description: parsed.data.description,
    methodology: parsed.data.methodology,
    startDate: new Date(parsed.data.startDate),
    endDate: new Date(parsed.data.endDate),
    status: parsed.data.status,
  }).returning({ id: schema.prevalenceStudies.id });
  await writeAuditLog({ actorId: user.id, action: "prevalence.study_create", entityType: "prevalence_study", entityId: inserted.id, after: parsed.data });
  revalidatePath("/prevalencia/estudios");
  return { ok: true, message: "Estudio creado." };
}

export async function createMetricAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "write:config"])) {
    return DENIED;
  }
  const parsed = metricSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { studyId: parsed.data.studyId });
  if (refError) {
    return { ok: false, message: refError };
  }
  const [inserted] = await db.insert(schema.prevalenceMetrics).values({
    organizationId: user.organizationId,
    studyId: parsed.data.studyId,
    indicatorKey: parsed.data.indicatorKey,
    label: parsed.data.label,
    description: parsed.data.description,
    valueType: parsed.data.valueType,
  }).returning({ id: schema.prevalenceMetrics.id });
  await writeAuditLog({ actorId: user.id, action: "prevalence.metric_create", entityType: "prevalence_metric", entityId: inserted.id, after: parsed.data });
  revalidatePath("/prevalencia/estudios");
  return { ok: true, message: "Indicador creado." };
}

// --------------------------------------------------------------------------
// Retencion de ubicacion (cron; autenticado por CRON_SECRET en la ruta)
// --------------------------------------------------------------------------
export async function pruneLocationRetentionAction(): Promise<ActionResult> {
  const db = getDb();
  await db.execute(sql`
    delete from delegate_location_pings p
    using location_tracking_settings s
    where p.user_id = s.user_id
      and p.captured_at < now() - (s.retention_days || ' days')::interval
  `);
  await writeAuditLog({ actorId: "system", action: "geolocation.retention_prune", entityType: "delegate_location_ping", entityId: "bulk" });
  return { ok: true, message: "Retencion de ubicaciones aplicada." };
}

// --------------------------------------------------------------------------
// Configuracion institucional
// --------------------------------------------------------------------------
export async function updateOrganizationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config"])) {
    return DENIED;
  }
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const values = {
    name: parsed.data.name,
    legalName: parsed.data.legalName || null,
    logoUrl: parsed.data.logoUrl || null,
    country: parsed.data.country,
    primaryColor: parsed.data.primaryColor,
    geolocationEnabled: parsed.data.geolocationEnabled,
    aiEnabled: parsed.data.aiEnabled,
    updatedAt: new Date(),
  };
  // Solo se actualiza la organizacion (tenant) del propio usuario.
  await db.update(schema.organizations).set(values).where(eq(schema.organizations.id, user.organizationId));
  await writeAuditLog({ actorId: user.id, action: "organization.update", entityType: "organization", entityId: user.organizationId, after: values });
  revalidatePath("/configuracion");
  return { ok: true, message: "Configuracion institucional actualizada." };
}

// Edita la landing page publica del inquilino (el sitio que ven en su
// subdominio/dominio). La administra el propio inquilino (write:config).
export async function updateLandingAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config"])) {
    return DENIED;
  }
  const parsed = landingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const d = parsed.data;
  const clean = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };
  // Las secciones (equipo/noticias/logros) llegan como JSON serializado desde
  // el editor. Se parsean con tolerancia y normalizeLanding las sanea y acota.
  const parseJson = (value: FormDataEntryValue | null): unknown => {
    if (typeof value !== "string" || !value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };
  const raw = {
    published: d.published,
    acceptsPublicReports: d.acceptsPublicReports,
    tagline: clean(d.tagline),
    about: clean(d.about),
    mission: clean(d.mission),
    heroImageUrl: clean(d.heroImageUrl),
    contactEmail: clean(d.contactEmail),
    contactPhone: clean(d.contactPhone),
    address: clean(d.address),
    website: clean(d.website),
    facebook: clean(d.facebook),
    instagram: clean(d.instagram),
    twitter: clean(d.twitter),
    team: parseJson(formData.get("teamJson")),
    news: parseJson(formData.get("newsJson")),
    achievements: parseJson(formData.get("achievementsJson")),
  };
  const landing: LandingContent = normalizeLanding(raw);
  const db = getDb();
  await db.update(schema.organizations).set({ landing, updatedAt: new Date() }).where(eq(schema.organizations.id, user.organizationId));
  await writeAuditLog({ actorId: user.id, action: "organization.landing_update", entityType: "organization", entityId: user.organizationId, after: { published: landing.published } });
  revalidatePath("/configuracion");
  revalidatePath("/");
  return { ok: true, message: landing.published ? "Landing publicada." : "Landing guardada (sin publicar)." };
}

export async function updateLocationSettingAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config"])) {
    return DENIED;
  }
  const parsed = locationSettingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  await db.update(schema.locationTrackingSettings).set({
    enabled: parsed.data.enabled,
    mode: parsed.data.mode,
    retentionDays: parsed.data.retentionDays,
    updatedBy: user.id,
    updatedAt: new Date(),
  }).where(and(eq(schema.locationTrackingSettings.id, parsed.data.id), eq(schema.locationTrackingSettings.organizationId, user.organizationId)));
  await writeAuditLog({ actorId: user.id, action: "location_setting.update", entityType: "location_tracking_setting", entityId: parsed.data.id, after: { enabled: parsed.data.enabled, mode: parsed.data.mode, retentionDays: parsed.data.retentionDays } });
  revalidatePath("/configuracion");
  return { ok: true, message: "Ajuste de ubicacion actualizado." };
}

export async function updateTerritoryLocationSettingAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config"])) {
    return DENIED;
  }
  const parsed = territoryLocationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { territoryId: parsed.data.territoryId });
  if (refError) {
    return { ok: false, message: refError };
  }
  const [existing] = await db.select({ id: schema.territoryLocationSettings.id }).from(schema.territoryLocationSettings).where(and(eq(schema.territoryLocationSettings.organizationId, user.organizationId), eq(schema.territoryLocationSettings.territoryId, parsed.data.territoryId))).limit(1);
  const values = {
    enabled: parsed.data.enabled,
    mode: parsed.data.mode,
    retentionDays: parsed.data.retentionDays,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(schema.territoryLocationSettings).set(values).where(eq(schema.territoryLocationSettings.id, existing.id));
  } else {
    await db.insert(schema.territoryLocationSettings).values({ organizationId: user.organizationId, territoryId: parsed.data.territoryId, ...values });
  }
  await writeAuditLog({ actorId: user.id, action: "territory_location_setting.update", entityType: "territory_location_setting", entityId: parsed.data.territoryId, after: values });
  revalidatePath("/configuracion");
  return { ok: true, message: "Configuracion territorial de ubicacion actualizada." };
}

// --------------------------------------------------------------------------
// Prompts IA: duplicar y restaurar version
// --------------------------------------------------------------------------
export async function duplicatePromptAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:admin", "write:config"])) {
    return DENIED;
  }
  const promptId = String(formData.get("promptId") ?? "");
  const db = getDb();
  const org = user.organizationId;
  const [source] = await db.select().from(schema.aiPromptTemplates).where(and(eq(schema.aiPromptTemplates.id, promptId), eq(schema.aiPromptTemplates.organizationId, org))).limit(1);
  if (!source) {
    return { ok: false, message: "Prompt no encontrado." };
  }
  const newKey = `${source.key}_copia`;
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(and(eq(schema.aiPromptTemplates.organizationId, org), eq(schema.aiPromptTemplates.key, newKey)));
  await db.insert(schema.aiPromptTemplates).values({
    organizationId: org,
    key: newKey,
    name: `${source.name} (copia)`,
    description: source.description,
    moduleScope: source.moduleScope,
    systemPrompt: source.systemPrompt,
    userPromptTemplate: source.userPromptTemplate,
    variables: source.variables,
    providerKey: source.providerKey,
    model: source.model,
    temperature: source.temperature,
    enabled: false,
    version,
    updatedBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "ai.prompt_duplicate", entityType: "ai_prompt_template", entityId: promptId, after: { newKey } });
  redirect("/asistente/prompts");
}

export async function restorePromptVersionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["ai:admin", "write:config"])) {
    return DENIED;
  }
  const sourceId = String(formData.get("promptId") ?? "");
  const db = getDb();
  const org = user.organizationId;
  const [source] = await db.select().from(schema.aiPromptTemplates).where(and(eq(schema.aiPromptTemplates.id, sourceId), eq(schema.aiPromptTemplates.organizationId, org))).limit(1);
  if (!source) {
    return { ok: false, message: "Version no encontrada." };
  }
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(and(eq(schema.aiPromptTemplates.organizationId, org), eq(schema.aiPromptTemplates.key, source.key)));
  await db.insert(schema.aiPromptTemplates).values({
    organizationId: org,
    key: source.key,
    name: source.name,
    description: source.description,
    moduleScope: source.moduleScope,
    systemPrompt: source.systemPrompt,
    userPromptTemplate: source.userPromptTemplate,
    variables: source.variables,
    providerKey: source.providerKey,
    model: source.model,
    temperature: source.temperature,
    enabled: source.enabled,
    version,
    updatedBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "ai.prompt_restore", entityType: "ai_prompt_template", entityId: source.key, after: { restoredFromVersion: source.version, newVersion: version } });
  redirect("/asistente/prompts");
}

// --------------------------------------------------------------------------
// Reportes
// --------------------------------------------------------------------------
export async function exportReportAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!can(user, ["reports:export"])) {
    return DENIED;
  }
  await writeAuditLog({
    actorId: user.id,
    action: "report.export",
    entityType: "report",
    entityId: String(formData.get("reportId") ?? "unknown"),
    after: { format: formData.get("format") },
  });
  return { ok: true, message: "Reporte marcado para exportacion. Los endpoints CSV/XLSX/PDF estan disponibles por tipo de reporte." };
}

// --------------------------------------------------------------------------
// Credencial QR: revocar / renovar / suspender
// --------------------------------------------------------------------------
export async function updateCredentialAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:territory", "*"])) {
    return DENIED;
  }
  const parsed = credentialActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud invalida." };
  }
  // getMemberById aplica el alcance territorial: si no hay acceso, no continua.
  const member = await getMemberById(parsed.data.memberId);
  if (!member) {
    return { ok: false, message: "No tienes acceso a este miembro." };
  }
  const db = getDb();
  const [credential] = await db.select().from(schema.memberCredentials).where(eq(schema.memberCredentials.memberId, parsed.data.memberId)).limit(1);
  if (!credential) {
    return { ok: false, message: "El miembro no tiene credencial emitida." };
  }
  if (parsed.data.action === "revoke") {
    await db.update(schema.memberCredentials).set({ status: "revocada" }).where(eq(schema.memberCredentials.id, credential.id));
    await writeAuditLog({ actorId: user.id, action: "credential.revoke", entityType: "member_credential", entityId: credential.id, before: { status: credential.status }, after: { status: "revocada" } });
    revalidatePath(`/miembros/${parsed.data.memberId}`);
    return { ok: true, message: "Credencial revocada." };
  }
  if (parsed.data.action === "suspend") {
    await db.update(schema.memberCredentials).set({ status: "suspendida" }).where(eq(schema.memberCredentials.id, credential.id));
    await writeAuditLog({ actorId: user.id, action: "credential.suspend", entityType: "member_credential", entityId: credential.id, before: { status: credential.status }, after: { status: "suspendida" } });
    revalidatePath(`/miembros/${parsed.data.memberId}`);
    return { ok: true, message: "Credencial suspendida." };
  }
  // renew: reactiva, extiende vigencia un anio y rota el token QR.
  await db.update(schema.memberCredentials).set({
    status: "activa",
    qrToken: crypto.randomUUID(),
    issuedAt: new Date(),
    expiresAt: new Date(nextYear()),
  }).where(eq(schema.memberCredentials.id, credential.id));
  await writeAuditLog({ actorId: user.id, action: "credential.renew", entityType: "member_credential", entityId: credential.id, before: { status: credential.status }, after: { status: "activa" } });
  revalidatePath(`/miembros/${parsed.data.memberId}`);
  return { ok: true, message: "Credencial renovada por un anio." };
}

// --------------------------------------------------------------------------
// Borrado administrativo manual de historial de ubicacion (politica interna)
// --------------------------------------------------------------------------
export async function purgeLocationHistoryAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config", "*"]) || !can(user, ["location:read", "*"])) {
    return DENIED;
  }
  const parsed = locationPurgeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud invalida." };
  }
  const db = getDb();
  // Siempre acotado al tenant del usuario: aun con scope "all" no puede
  // purgar ubicaciones de otra organizacion.
  const conditions: SQL[] = [eq(schema.delegateLocationPings.organizationId, user.organizationId)];
  if (parsed.data.scope === "territory") {
    if (!parsed.data.territoryId) {
      return { ok: false, message: "Selecciona el territorio a purgar." };
    }
    conditions.push(eq(schema.delegateLocationPings.territoryId, parsed.data.territoryId));
  }
  if (parsed.data.scope === "user") {
    if (!parsed.data.userId) {
      return { ok: false, message: "Selecciona el usuario a purgar." };
    }
    conditions.push(eq(schema.delegateLocationPings.userId, parsed.data.userId));
  }
  if (parsed.data.before) {
    conditions.push(lt(schema.delegateLocationPings.capturedAt, new Date(parsed.data.before)));
  }
  const result = await db.delete(schema.delegateLocationPings).where(conditions.length ? and(...conditions) : undefined).returning({ id: schema.delegateLocationPings.id });
  await writeAuditLog({
    actorId: user.id,
    action: "geolocation.manual_purge",
    entityType: "delegate_location_ping",
    entityId: "bulk",
    after: { scope: parsed.data.scope, territoryId: parsed.data.territoryId, userId: parsed.data.userId, before: parsed.data.before, deleted: result.length },
  });
  revalidatePath("/configuracion");
  revalidatePath("/operacion-territorial/geolocalizacion");
  return { ok: true, message: `Se eliminaron ${result.length} registros de ubicacion.` };
}

// --------------------------------------------------------------------------
// Administracion de usuarios y roles (solo * / write:config)
// --------------------------------------------------------------------------
async function resolveRoleId(db: ReturnType<typeof getDb>, key: string) {
  const [role] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.key, key)).limit(1);
  return role?.id;
}

export async function createUserAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config", "*"])) {
    return DENIED;
  }
  const parsed = userFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const email = parsed.data.email.toLowerCase();
  const db = getDb();
  const org = user.organizationId;
  const overCapacity = await planCapacityError(org, "users");
  if (overCapacity) {
    return { ok: false, message: overCapacity };
  }
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.organizationId, org), eq(schema.users.email, email))).limit(1);
  if (existing.length) {
    return { ok: false, message: "Ya existe un usuario con ese correo." };
  }
  const roleId = await resolveRoleId(db, parsed.data.role);
  if (!roleId) {
    return { ok: false, message: "El rol seleccionado no existe." };
  }
  if (parsed.data.territoryId) {
    const refError = await orgRefError(db, org, { territoryId: parsed.data.territoryId });
    if (refError) {
      return { ok: false, message: refError };
    }
  }
  const id = crypto.randomUUID();
  await db.insert(schema.users).values({
    id,
    organizationId: org,
    name: parsed.data.name,
    email,
    phone: parsed.data.phone || null,
    passwordHash: await hash(parsed.data.password, 12),
    providerId: null,
    status: parsed.data.status,
  });
  const scoped = Boolean(parsed.data.territoryId);
  await db.insert(schema.userRoles).values({
    organizationId: org,
    userId: id,
    roleId,
    scopeType: scoped ? "territory" : "global",
    scopeId: scoped ? parsed.data.territoryId! : null,
  }).onConflictDoNothing();
  await writeAuditLog({ actorId: user.id, action: "user.create", entityType: "user", entityId: id, after: { email, role: parsed.data.role, status: parsed.data.status } });
  revalidatePath("/configuracion/usuarios");
  return { ok: true, message: "Usuario creado." };
}

export async function setUserStatusAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config", "*"])) {
    return DENIED;
  }
  const parsed = userStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  if (parsed.data.userId === user.id && parsed.data.status !== "active") {
    return { ok: false, message: "No puedes desactivar tu propia cuenta." };
  }
  const db = getDb();
  await db.update(schema.users).set({ status: parsed.data.status, updatedAt: new Date() }).where(and(eq(schema.users.id, parsed.data.userId), eq(schema.users.organizationId, user.organizationId)));
  await writeAuditLog({ actorId: user.id, action: "user.status_change", entityType: "user", entityId: parsed.data.userId, after: { status: parsed.data.status } });
  revalidatePath("/configuracion/usuarios");
  return { ok: true, message: `Usuario ${parsed.data.status === "active" ? "activado" : "desactivado"}.` };
}

export async function assignUserRoleAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config", "*"])) {
    return DENIED;
  }
  const parsed = roleAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const org = user.organizationId;
  const [target] = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.id, parsed.data.userId), eq(schema.users.organizationId, org))).limit(1);
  if (!target) {
    return { ok: false, message: "El usuario no pertenece a tu organizacion." };
  }
  const roleId = await resolveRoleId(db, parsed.data.role);
  if (!roleId) {
    return { ok: false, message: "El rol seleccionado no existe." };
  }
  const scoped = Boolean(parsed.data.territoryId);
  if (scoped) {
    const refError = await orgRefError(db, org, { territoryId: parsed.data.territoryId });
    if (refError) {
      return { ok: false, message: refError };
    }
  }
  await db.insert(schema.userRoles).values({
    organizationId: org,
    userId: parsed.data.userId,
    roleId,
    scopeType: scoped ? "territory" : "global",
    scopeId: scoped ? parsed.data.territoryId! : null,
  }).onConflictDoUpdate({
    target: [schema.userRoles.userId, schema.userRoles.roleId, schema.userRoles.scopeType],
    set: { scopeId: scoped ? parsed.data.territoryId! : null },
  });
  await writeAuditLog({ actorId: user.id, action: "user.role_assign", entityType: "user", entityId: parsed.data.userId, after: { role: parsed.data.role, territoryId: parsed.data.territoryId ?? null } });
  revalidatePath("/configuracion/usuarios");
  return { ok: true, message: "Rol asignado." };
}

export async function removeUserRoleAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:config", "*"])) {
    return DENIED;
  }
  const parsed = roleRemovalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  if (parsed.data.userId === user.id && parsed.data.role === "super_admin") {
    return { ok: false, message: "No puedes quitarte a ti mismo el rol de super administrador." };
  }
  const db = getDb();
  const roleId = await resolveRoleId(db, parsed.data.role);
  if (!roleId) {
    return { ok: false, message: "El rol seleccionado no existe." };
  }
  const conditions: SQL[] = [
    eq(schema.userRoles.organizationId, user.organizationId),
    eq(schema.userRoles.userId, parsed.data.userId),
    eq(schema.userRoles.roleId, roleId),
    eq(schema.userRoles.scopeType, parsed.data.scopeType),
  ];
  if (parsed.data.scopeId) {
    conditions.push(eq(schema.userRoles.scopeId, parsed.data.scopeId));
  }
  await db.delete(schema.userRoles).where(and(...conditions));
  await writeAuditLog({ actorId: user.id, action: "user.role_remove", entityType: "user", entityId: parsed.data.userId, after: { role: parsed.data.role, scopeType: parsed.data.scopeType } });
  revalidatePath("/configuracion/usuarios");
  return { ok: true, message: "Rol removido." };
}

// --------------------------------------------------------------------------
// Portal de miembro: levantar reportes, seguir sus casos, actualizar datos
// --------------------------------------------------------------------------
export async function createMemberReportAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const member = await getMemberSelf();
  if (!member) {
    return { ok: false, message: "Solo los miembros pueden levantar reportes desde el portal." };
  }
  const parsed = memberReportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const org = user.organizationId;
  const overCapacity = await planCapacityError(org, "cases");
  if (overCapacity) {
    return { ok: false, message: overCapacity };
  }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.cases).where(eq(schema.cases.organizationId, org));
  const id = crypto.randomUUID();
  const caseNumber = `${await orgCode(db, org)}-CASO-${new Date().getFullYear()}-${String(total + 1).padStart(4, "0")}`;
  // El miembro es quien abre el reporte; queda sin responsable asignado (se
  // asigna al propio miembro como marcador) y en estado "Nuevo" para que el
  // personal del territorio lo triage y reasigne.
  const d = parsed.data;
  await db.insert(schema.cases).values({
    id,
    organizationId: org,
    caseNumber,
    title: d.title,
    description: d.description,
    category: d.category,
    priority: "Media",
    status: "Nuevo",
    territoryId: member.territoryId,
    openedBy: user.id,
    assignedTo: user.id,
    openedAt: new Date(),
    incidentDate: d.incidentDate ? new Date(d.incidentDate) : null,
    incidentLocation: d.incidentLocation || null,
    rightViolated: d.rightViolated || null,
  });
  const affectedDemographics = {
    ...(d.victimGender ? { genero: d.victimGender } : {}),
    ...(d.victimAgeGroup ? { grupoEdad: d.victimAgeGroup } : {}),
  };
  // Persona afectada: el propio miembro, o la persona que reporta a nombre de.
  // organizationId se estampa al insertar (people.map mas abajo).
  const people: Array<Omit<typeof schema.casePeople.$inferInsert, "organizationId">> = [];
  if (d.onBehalf && d.affectedName?.trim()) {
    people.push({
      caseId: id,
      personType: "victima",
      name: d.affectedName.trim(),
      contact: d.affectedContact?.trim() || "Reservado",
      demographicData: { ...affectedDemographics, ...(d.affectedRelation ? { relacion: d.affectedRelation } : {}) },
      consentStatus: d.consentStatus,
    });
    // El miembro es quien reporta (solicitante).
    people.push({
      caseId: id,
      personType: "solicitante",
      name: member.fullName,
      contact: member.phone || "Reservado",
      demographicData: {},
      consentStatus: d.consentStatus,
    });
  } else {
    people.push({
      caseId: id,
      personType: "victima",
      name: member.fullName,
      contact: member.phone || "Reservado",
      demographicData: affectedDemographics,
      consentStatus: d.consentStatus,
    });
  }
  // Autoridad o institucion senalada.
  if (d.authorityName?.trim()) {
    people.push({
      caseId: id,
      personType: "autoridad",
      name: d.authorityName.trim(),
      contact: "N/A",
      demographicData: {},
      consentStatus: "no_aplica",
    });
  }
  await db.insert(schema.casePeople).values(people.map((p) => ({ ...p, organizationId: org })));
  await db.insert(schema.caseStatusHistory).values({
    organizationId: org,
    caseId: id,
    fromStatus: null,
    toStatus: "Nuevo",
    reason: "Reporte levantado por el miembro desde el portal",
    changedBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "case.member_report", entityType: "case", entityId: id, after: { caseNumber, category: parsed.data.category } });
  await createNotification({
    organizationId: org,
    kind: "member_report",
    title: `Nuevo reporte de miembro: ${caseNumber}`,
    body: `${parsed.data.category} — ${d.title}`,
    entityType: "case",
    entityId: id,
    href: `/casos/${id}`,
  });
  revalidatePath("/portal/mis-reportes");
  return { ok: true, message: `Reporte ${caseNumber} enviado. El equipo le dara seguimiento.` };
}

// Foto del miembro: la sube el propio miembro (sin memberId) o el personal
// (con memberId, requiere write:territory y acceso al miembro).
export async function updateMemberPhotoAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  const parsed = memberPhotoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  let memberId = parsed.data.memberId;
  if (memberId) {
    if (!can(actor, ["write:territory", "*"])) {
      return DENIED;
    }
    const member = await getMemberById(memberId);
    if (!member) {
      return { ok: false, message: "No tienes acceso a este miembro." };
    }
  } else {
    const self = await getMemberSelf();
    if (!self) {
      return { ok: false, message: "Solo un miembro puede subir su propia fotografia." };
    }
    memberId = self.id;
  }
  await db.update(schema.members).set({ photoUrl: parsed.data.photoUrl, updatedAt: new Date() }).where(and(eq(schema.members.id, memberId), eq(schema.members.organizationId, actor.organizationId)));
  await writeAuditLog({ actorId: actor.id, action: "member.photo_update", entityType: "member", entityId: memberId, after: { photoUrl: parsed.data.photoUrl } });
  revalidatePath("/portal/perfil");
  revalidatePath(`/miembros/${memberId}`);
  return { ok: true, message: "Fotografia actualizada." };
}

export async function updateMemberProfileAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const member = await getMemberSelf();
  if (!member) {
    return DENIED;
  }
  const parsed = memberProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  await db.update(schema.members).set({
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
    updatedAt: new Date(),
  }).where(and(eq(schema.members.id, member.id), eq(schema.members.organizationId, user.organizationId)));
  await writeAuditLog({ actorId: user.id, action: "member.profile_update", entityType: "member", entityId: member.id, after: { phone: parsed.data.phone, email: parsed.data.email } });
  revalidatePath("/portal/perfil");
  return { ok: true, message: "Datos actualizados." };
}

// Personal: provisiona o restablece el acceso al portal de un miembro
// (crea la cuenta de usuario ligada con rol member y define su contrasena).
export async function setMemberAccessAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!can(actor, ["write:territory", "*"])) {
    return DENIED;
  }
  const parsed = memberAccessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const member = await getMemberById(parsed.data.memberId);
  if (!member) {
    return { ok: false, message: "No tienes acceso a este miembro." };
  }
  const db = getDb();
  const org = actor.organizationId;
  const passwordHash = await hash(parsed.data.password, 12);
  const [record] = await db.select().from(schema.members).where(and(eq(schema.members.id, parsed.data.memberId), eq(schema.members.organizationId, org))).limit(1);
  if (record.userId) {
    await db.update(schema.users).set({ passwordHash, status: "active", updatedAt: new Date() }).where(and(eq(schema.users.id, record.userId), eq(schema.users.organizationId, org)));
    await writeAuditLog({ actorId: actor.id, action: "member.access_reset", entityType: "member", entityId: member.id, after: { userId: record.userId } });
    revalidatePath(`/miembros/${member.id}`);
    return { ok: true, message: "Contrasena del portal restablecida." };
  }
  // Sin cuenta previa: crear usuario ligado con rol member en su territorio.
  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.organizationId, org), eq(schema.users.email, record.email.toLowerCase()))).limit(1);
  if (existing.length) {
    return { ok: false, message: "Ya existe un usuario con el correo del miembro. Usa otro correo o vincula manualmente." };
  }
  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    organizationId: org,
    name: record.fullName,
    email: record.email.toLowerCase(),
    phone: record.phone,
    passwordHash,
    providerId: null,
    status: "active",
  });
  const roleId = await resolveRoleId(db, "member");
  if (roleId) {
    await db.insert(schema.userRoles).values({ organizationId: org, userId, roleId, scopeType: "territory", scopeId: record.territoryId }).onConflictDoNothing();
  }
  await db.update(schema.members).set({ userId, updatedAt: new Date() }).where(and(eq(schema.members.id, member.id), eq(schema.members.organizationId, org)));
  await writeAuditLog({ actorId: actor.id, action: "member.access_provision", entityType: "member", entityId: member.id, after: { userId } });
  revalidatePath(`/miembros/${member.id}`);
  return { ok: true, message: "Acceso al portal creado. El miembro ya puede iniciar sesion con su correo." };
}

export async function reassignCaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:territory", "*"])) {
    return DENIED;
  }
  const parsed = caseReassignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const record = await getCaseById(parsed.data.caseId);
  if (!record) {
    return { ok: false, message: "No tienes acceso a este caso." };
  }
  const db = getDb();
  const refError = await orgRefError(db, user.organizationId, { userId: parsed.data.assignedTo });
  if (refError) {
    return { ok: false, message: refError };
  }
  await db.update(schema.cases).set({ assignedTo: parsed.data.assignedTo }).where(and(eq(schema.cases.id, parsed.data.caseId), eq(schema.cases.organizationId, user.organizationId)));
  await writeAuditLog({ actorId: user.id, action: "case.reassign", entityType: "case", entityId: parsed.data.caseId, before: { assignedTo: record.assignedTo }, after: { assignedTo: parsed.data.assignedTo } });
  revalidatePath(`/casos/${parsed.data.caseId}`);
  return { ok: true, message: "Responsable actualizado." };
}

function nextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
