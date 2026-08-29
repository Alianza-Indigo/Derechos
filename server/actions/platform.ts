"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { runAssistant } from "@/lib/ai/adapters";
import { normalizeSearch } from "@/lib/utils";
import {
  aiRunSchema,
  caseFormSchema,
  casePersonSchema,
  caseStatusUpdateSchema,
  caseTimelineActionSchema,
  checkInSchema,
  commissionFormSchema,
  evidenceFormSchema,
  eventFormSchema,
  locationPauseSchema,
  locationSettingSchema,
  memberFormSchema,
  metricSchema,
  organizationSchema,
  prevalenceRecordSchema,
  studySchema,
  territoryLocationSchema,
  providerConfigSchema,
  promptTemplateSchema,
} from "@/lib/validators";
import { writeAuditLog } from "@/server/audit/log";
import { getDb } from "@/server/db";
import { canAccessTerritory, hasAnyPermission } from "@/server/permissions/rbac";
import { getCurrentUser } from "@/server/queries/app";
import type { User } from "@/lib/types";

type ActionResult = {
  ok: boolean;
  message: string;
  output?: string;
};

const DENIED: ActionResult = { ok: false, message: "No tienes permiso para realizar esta accion." };

function can(user: User, permissions: string[]) {
  return hasAnyPermission(user, permissions);
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
  const duplicate = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(sql`${schema.members.email} = ${parsed.data.email} or ${schema.members.phone} = ${parsed.data.phone}`)
    .limit(1);
  if (duplicate.length) {
    return { ok: false, message: "Ya existe un miembro con ese correo o telefono." };
  }
  // Deteccion de posible duplicado por nombre similar en el mismo territorio.
  const territoryMembers = await db
    .select({ fullName: schema.members.fullName })
    .from(schema.members)
    .where(eq(schema.members.territoryId, parsed.data.territoryId));
  const normalizedNew = normalizeSearch(parsed.data.fullName);
  if (territoryMembers.some((member) => normalizeSearch(member.fullName) === normalizedNew)) {
    return { ok: false, message: "Ya existe un miembro con un nombre muy similar en ese territorio. Verifica posibles duplicados." };
  }

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.members);
  const id = crypto.randomUUID();
  const slug = `credencial-${crypto.randomUUID().slice(0, 8)}`;
  const memberNumber = `ORG-CHH-${String(total + 1).padStart(6, "0")}`;
  await db.insert(schema.members).values({
    id,
    memberNumber,
    fullName: parsed.data.fullName,
    birthDate: new Date(parsed.data.birthDate),
    gender: parsed.data.gender,
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
    territoryId: parsed.data.territoryId,
    status: parsed.data.status,
    joinedAt: new Date(),
  });
  await db.insert(schema.memberCredentials).values({
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

// --------------------------------------------------------------------------
// Casos
// --------------------------------------------------------------------------
export async function createCaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!can(user, ["write:case", "write:territory"])) {
    return DENIED;
  }
  const parsed = caseFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.cases);
  const id = crypto.randomUUID();
  const caseNumber = `CASO-2026-CHH-${String(total + 1).padStart(4, "0")}`;
  await db.insert(schema.cases).values({
    id,
    caseNumber,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: parsed.data.status,
    territoryId: parsed.data.territoryId,
    openedBy: user.id,
    assignedTo: parsed.data.assignedTo,
    openedAt: new Date(),
  });
  await db.insert(schema.casePeople).values({
    caseId: id,
    personType: "solicitante",
    name: "Persona protegida",
    contact: "Reservado",
    demographicData: {},
    consentStatus: parsed.data.consentStatus,
  });
  await db.insert(schema.caseStatusHistory).values({
    caseId: id,
    fromStatus: null,
    toStatus: parsed.data.status,
    reason: "Alta inicial del caso",
    changedBy: user.id,
  });
  await db.insert(schema.caseNotes).values({
    caseId: id,
    note: "Caso creado desde formulario institucional.",
    createdBy: user.id,
  });
  await writeAuditLog({ actorId: user.id, action: "case.create", entityType: "case", entityId: id, after: { ...parsed.data, caseNumber } });
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
  const [current] = await db.select().from(schema.cases).where(eq(schema.cases.id, parsed.data.caseId)).limit(1);
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
  }).where(eq(schema.cases.id, parsed.data.caseId));
  await db.insert(schema.caseStatusHistory).values({
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
    const [current] = await db.select().from(schema.cases).where(eq(schema.cases.id, parsed.data.entityId)).limit(1);
    if (!current || !(canAccessTerritory(user, current.territoryId) || current.assignedTo === user.id || current.openedBy === user.id)) {
      return { ok: false, message: "Caso no encontrado o sin acceso." };
    }
    const id = crypto.randomUUID();
    await db.insert(schema.caseEvidence).values({
      id,
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
  const [current] = await db.select().from(schema.events).where(eq(schema.events.id, parsed.data.entityId)).limit(1);
  if (!current || !canAccessTerritory(user, current.territoryId)) {
    return { ok: false, message: "Evento no encontrado o sin acceso." };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.eventEvidence).values({
    id,
    eventId: parsed.data.entityId,
    fileUrl: parsed.data.fileUrl,
    type: parsed.data.fileType,
    description: parsed.data.description,
  });
  await writeAuditLog({ actorId: user.id, action: "evidence.upload", entityType: "event_evidence", entityId: id, after: parsed.data });
  revalidatePath(`/eventos/${parsed.data.entityId}`);
  return { ok: true, message: "Evidencia de evento registrada." };
}

async function assertCaseAccess(userId: string, canTerritory: (t: string) => boolean, caseId: string) {
  const db = getDb();
  const [record] = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
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
  const record = await assertCaseAccess(user.id, (t) => canAccessTerritory(user, t), parsed.data.caseId);
  if (!record) {
    return { ok: false, message: "Caso no encontrado o sin acceso." };
  }
  const db = getDb();
  await db.insert(schema.casePeople).values({
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
  const record = await assertCaseAccess(user.id, (t) => canAccessTerritory(user, t), parsed.data.caseId);
  if (!record) {
    return { ok: false, message: "Caso no encontrado o sin acceso." };
  }
  const db = getDb();
  await db.insert(schema.caseActions).values({
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
  const id = crypto.randomUUID();
  await db.insert(schema.events).values({
    id,
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
  const id = crypto.randomUUID();
  await db.insert(schema.fieldCommissions).values({
    id,
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
  const [setting] = await db.select().from(schema.locationTrackingSettings).where(eq(schema.locationTrackingSettings.userId, user.id)).limit(1);
  if (setting && !setting.enabled) {
    return { ok: false, message: "La geolocalizacion esta deshabilitada o pausada para este usuario." };
  }
  const id = crypto.randomUUID();
  await db.insert(schema.delegateLocationPings).values({
    id,
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
  const [row] = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, parsed.data.promptTemplateId)).limit(1);
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

  const result = await runAssistant({
    prompt,
    message: parsed.data.message,
    context: {
      usuario: user.name,
      rol: user.roles.join(", "),
      territorio: user.territoryId,
      relatedCaseId: parsed.data.relatedCaseId,
      relatedEventId: parsed.data.relatedEventId,
      fieldCommissionId: parsed.data.fieldCommissionId,
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "ai.run",
    entityType: "ai_prompt_template",
    entityId: prompt.id,
    after: { provider: result.provider, model: result.model, status: result.status },
  });

  const conversationId = crypto.randomUUID();
  await db.insert(schema.aiConversations).values({
    id: conversationId,
    userId: user.id,
    relatedCaseId: parsed.data.relatedCaseId || null,
    relatedEventId: parsed.data.relatedEventId || null,
    fieldCommissionId: parsed.data.fieldCommissionId || null,
    promptTemplateId: prompt.id,
    title: prompt.name,
    status: "activa",
  });
  await db.insert(schema.aiMessages).values([
    { conversationId, role: "user", content: parsed.data.message, metadata: {} },
    { conversationId, role: "assistant", content: result.output, metadata: { provider: result.provider, model: result.model } },
  ]);
  await db.insert(schema.aiRuns).values({
    conversationId,
    promptTemplateId: prompt.id,
    input: { message: parsed.data.message },
    outputText: result.output,
    model: result.model,
    tokenUsage: result.tokenUsage,
    status: result.status,
  });

  return { ok: true, message: `Respuesta generada con ${result.provider}/${result.model}.`, output: result.output };
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
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(eq(schema.aiPromptTemplates.key, parsed.data.key));
  const id = crypto.randomUUID();
  await db.insert(schema.aiPromptTemplates).values({
    id,
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
  }).where(eq(schema.aiProviderConfigs.providerKey, parsed.data.providerKey));
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
  const id = crypto.randomUUID();
  await db.insert(schema.prevalenceRecords).values({
    id,
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
  const [inserted] = await db.insert(schema.prevalenceMetrics).values({
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
  const [existing] = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
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
  if (existing) {
    await db.update(schema.organizations).set(values).where(eq(schema.organizations.id, existing.id));
  } else {
    await db.insert(schema.organizations).values(values);
  }
  await writeAuditLog({ actorId: user.id, action: "organization.update", entityType: "organization", entityId: existing?.id ?? "org", after: values });
  revalidatePath("/configuracion");
  return { ok: true, message: "Configuracion institucional actualizada." };
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
  }).where(eq(schema.locationTrackingSettings.id, parsed.data.id));
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
  const [existing] = await db.select({ id: schema.territoryLocationSettings.id }).from(schema.territoryLocationSettings).where(eq(schema.territoryLocationSettings.territoryId, parsed.data.territoryId)).limit(1);
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
    await db.insert(schema.territoryLocationSettings).values({ territoryId: parsed.data.territoryId, ...values });
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
  const [source] = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, promptId)).limit(1);
  if (!source) {
    return { ok: false, message: "Prompt no encontrado." };
  }
  const newKey = `${source.key}_copia`;
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(eq(schema.aiPromptTemplates.key, newKey));
  await db.insert(schema.aiPromptTemplates).values({
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
  const [source] = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, sourceId)).limit(1);
  if (!source) {
    return { ok: false, message: "Version no encontrada." };
  }
  const [{ version }] = await db
    .select({ version: sql<number>`coalesce(max(${schema.aiPromptTemplates.version}), 0)::int + 1` })
    .from(schema.aiPromptTemplates)
    .where(eq(schema.aiPromptTemplates.key, source.key));
  await db.insert(schema.aiPromptTemplates).values({
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

function nextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}
