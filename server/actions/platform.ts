"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import {
  aiPromptTemplates,
  allLocationPings,
  cases,
  events,
  fieldCommissions,
  members,
} from "@/lib/mock-data";
import { runAssistant } from "@/lib/ai/adapters";
import { makeId } from "@/lib/utils";
import {
  aiRunSchema,
  caseFormSchema,
  caseStatusUpdateSchema,
  checkInSchema,
  commissionFormSchema,
  evidenceFormSchema,
  eventFormSchema,
  memberFormSchema,
  prevalenceRecordSchema,
  providerConfigSchema,
  promptTemplateSchema,
} from "@/lib/validators";
import { writeAuditLog } from "@/server/audit/log";
import { getDb } from "@/server/db";
import { getCurrentUser, nextCaseNumber, nextMemberNumber } from "@/server/queries/app";

type ActionResult = {
  ok: boolean;
  message: string;
  output?: string;
};

export async function createMemberAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = memberFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  if (db) {
    const duplicate = await db.select({ id: schema.members.id }).from(schema.members).where(sql`${schema.members.email} = ${parsed.data.email} or ${schema.members.phone} = ${parsed.data.phone}`).limit(1);
    if (duplicate.length) {
      return { ok: false, message: "Ya existe un miembro con ese correo o telefono." };
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

  const duplicate = members.find((member) => member.email === parsed.data.email || member.phone === parsed.data.phone);
  if (duplicate) {
    return { ok: false, message: "Ya existe un miembro con ese correo o telefono." };
  }

  const id = makeId("m");
  const slug = `credencial-${crypto.randomUUID().slice(0, 8)}`;
  members.unshift({
    id,
    memberNumber: nextMemberNumber(),
    fullName: parsed.data.fullName,
    birthDate: parsed.data.birthDate,
    gender: parsed.data.gender,
    phone: parsed.data.phone,
    email: parsed.data.email,
    address: parsed.data.address,
    territoryId: parsed.data.territoryId,
    status: parsed.data.status,
    joinedAt: new Date().toISOString(),
    credentialSlug: slug,
    credentialStatus: parsed.data.status === "activo" ? "activa" : "suspendida",
    credentialExpiresAt: nextYear(),
  });
  await writeAuditLog({ actorId: user.id, action: "member.create", entityType: "member", entityId: id, after: parsed.data });
  await writeAuditLog({ actorId: user.id, action: "credential.issue", entityType: "member_credential", entityId: slug, after: { publicSlug: slug } });
  redirect(`/miembros/${id}`);
}

export async function createCaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = caseFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  if (db) {
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

  const id = makeId("case");
  cases.unshift({
    id,
    caseNumber: nextCaseNumber(),
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    priority: parsed.data.priority,
    status: parsed.data.status,
    territoryId: parsed.data.territoryId,
    openedBy: user.id,
    assignedTo: parsed.data.assignedTo,
    openedAt: new Date().toISOString(),
    dueDate: undefined,
    persons: [
      {
        id: makeId("person"),
        personType: "solicitante",
        name: "Persona protegida",
        contact: "Reservado",
        demographicData: {},
        consentStatus: parsed.data.consentStatus,
      },
    ],
    actions: [],
    evidence: [],
    internalNotes: ["Caso creado desde formulario institucional."],
  });
  await writeAuditLog({ actorId: user.id, action: "case.create", entityType: "case", entityId: id, after: parsed.data });
  redirect(`/casos/${id}`);
}

export async function createEventAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  if (db) {
    const id = crypto.randomUUID();
    await db.insert(schema.events).values({
      id,
      title: parsed.data.title,
      description: parsed.data.description,
      eventType: parsed.data.eventType,
      dateStart: new Date(parsed.data.dateStart),
      dateEnd: new Date(parsed.data.dateEnd),
      location: parsed.data.location,
      territoryId: parsed.data.territoryId,
      organizerId: user.id,
      attendeesCount: parsed.data.attendeesCount,
      institutions: [],
      impactSummary: parsed.data.impactSummary,
      indicators: ["Personas atendidas"],
    });
    await writeAuditLog({ actorId: user.id, action: "event.create", entityType: "event", entityId: id, after: parsed.data });
    redirect(`/eventos/${id}`);
  }

  const id = makeId("event");
  events.unshift({
    id,
    title: parsed.data.title,
    description: parsed.data.description,
    eventType: parsed.data.eventType,
    dateStart: parsed.data.dateStart,
    dateEnd: parsed.data.dateEnd,
    location: parsed.data.location,
    territoryId: parsed.data.territoryId,
    organizerId: user.id,
    attendeesCount: parsed.data.attendeesCount,
    institutions: [],
    impactSummary: parsed.data.impactSummary,
    indicators: ["Personas atendidas"],
    evidence: [],
  });
  await writeAuditLog({ actorId: user.id, action: "event.create", entityType: "event", entityId: id, after: parsed.data });
  redirect(`/eventos/${id}`);
}

export async function createCommissionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = commissionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  if (db) {
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

  const id = makeId("fc");
  fieldCommissions.unshift({
    id,
    title: parsed.data.title,
    commissionType: parsed.data.commissionType,
    description: parsed.data.description,
    assignedTo: parsed.data.assignedTo,
    territoryId: parsed.data.territoryId,
    status: "programada",
    scheduledAt: parsed.data.scheduledAt,
    checkIns: [],
  });
  await writeAuditLog({ actorId: user.id, action: "commission.assign", entityType: "field_commission", entityId: id, after: parsed.data });
  redirect(`/operacion-territorial/comisiones/${id}`);
}

export async function createCheckInAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Ubicacion invalida." };
  }

  const db = getDb();
  if (db) {
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
    return { ok: true, message: "Check-in registrado con ubicacion autorizada y auditoria." };
  }

  const ping = {
    id: makeId("ping"),
    userId: user.id,
    fieldCommissionId: parsed.data.fieldCommissionId,
    territoryId: parsed.data.territoryId,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    accuracyMeters: parsed.data.accuracyMeters,
    captureMode: parsed.data.captureMode,
    batteryLevel: parsed.data.batteryLevel,
    status: parsed.data.captureMode === "commission" ? "en_comision" : "disponible",
    capturedAt: new Date().toISOString(),
  } as const;

  allLocationPings.unshift(ping);
  const commission = fieldCommissions.find((item) => item.id === parsed.data.fieldCommissionId);
  commission?.checkIns.unshift(ping);
  await writeAuditLog({ actorId: user.id, action: "geolocation.check_in", entityType: "delegate_location_ping", entityId: ping.id, after: { ...parsed.data, latitude: "redacted", longitude: "redacted" } });
  return { ok: true, message: "Check-in registrado con ubicacion autorizada y auditoria." };
}

export async function runAssistantAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = aiRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud invalida." };
  }
  const db = getDb();
  const prompt = db
    ? await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, parsed.data.promptTemplateId)).limit(1).then(([row]) => row && {
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
    })
    : aiPromptTemplates.find((item) => item.id === parsed.data.promptTemplateId);
  if (!prompt || !prompt.enabled) {
    return { ok: false, message: "El prompt no existe o esta desactivado." };
  }

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

  if (db) {
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
  }

  return { ok: true, message: `Respuesta generada con ${result.provider}/${result.model}.`, output: result.output };
}

export async function savePromptAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = promptTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Prompt invalido." };
  }

  const db = getDb();
  if (db) {
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

  aiPromptTemplates.unshift({
    id: makeId("prompt"),
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description,
    moduleScope: parsed.data.moduleScope,
    systemPrompt: parsed.data.systemPrompt,
    userPromptTemplate: parsed.data.userPromptTemplate,
    variables: parsed.data.variables,
    providerKey: parsed.data.providerKey,
    model: parsed.data.model,
    temperature: parsed.data.temperature,
    enabled: parsed.data.enabled,
    version: 1 + aiPromptTemplates.filter((prompt) => prompt.key === parsed.data.key).length,
    updatedBy: user.id,
    updatedAt: new Date().toISOString(),
  });
  await writeAuditLog({ actorId: user.id, action: "ai.prompt_update", entityType: "ai_prompt_template", entityId: parsed.data.key, after: parsed.data });
  redirect("/asistente/prompts");
}

export async function updateCaseStatusAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = caseStatusUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Cambio invalido." };
  }
  const db = getDb();
  if (db) {
    const [current] = await db.select().from(schema.cases).where(eq(schema.cases.id, parsed.data.caseId)).limit(1);
    if (!current) {
      return { ok: false, message: "Caso no encontrado." };
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
    return { ok: true, message: "Estado actualizado con motivo y auditoria." };
  }
  const record = cases.find((item) => item.id === parsed.data.caseId);
  if (record) {
    record.status = parsed.data.status;
    record.internalNotes.unshift(`Cambio de estado: ${parsed.data.reason}`);
  }
  await writeAuditLog({ actorId: user.id, action: "case.status_change", entityType: "case", entityId: parsed.data.caseId, after: parsed.data });
  return { ok: true, message: "Estado actualizado con motivo y auditoria." };
}

export async function addEvidenceAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = evidenceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Evidencia invalida." };
  }
  const db = getDb();
  if (db && parsed.data.entityType === "case") {
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
    return { ok: true, message: "Evidencia protegida registrada." };
  }
  if (db && parsed.data.entityType === "event") {
    const id = crypto.randomUUID();
    await db.insert(schema.eventEvidence).values({
      id,
      eventId: parsed.data.entityId,
      fileUrl: parsed.data.fileUrl,
      type: parsed.data.fileType,
      description: parsed.data.description,
    });
    await writeAuditLog({ actorId: user.id, action: "evidence.upload", entityType: "event_evidence", entityId: id, after: parsed.data });
    return { ok: true, message: "Evidencia de evento registrada." };
  }
  await writeAuditLog({ actorId: user.id, action: "evidence.upload", entityType: parsed.data.entityType, entityId: parsed.data.entityId, after: parsed.data });
  return { ok: true, message: "Evidencia registrada en modo demo." };
}

export async function createPrevalenceRecordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = prevalenceRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Medicion invalida." };
  }
  const db = getDb();
  if (db) {
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
    return { ok: true, message: "Medicion guardada." };
  }
  await writeAuditLog({ actorId: user.id, action: "prevalence.record_create", entityType: "prevalence_record", entityId: "demo", after: parsed.data });
  return { ok: true, message: "Medicion validada en modo demo." };
}

export async function updateProviderConfigAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = providerConfigSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Proveedor invalido." };
  }
  const db = getDb();
  if (db) {
    await db.update(schema.aiProviderConfigs).set({
      enabled: parsed.data.enabled,
      defaultModel: parsed.data.defaultModel,
      priority: parsed.data.priority,
      updatedBy: user.id,
      updatedAt: new Date(),
    }).where(eq(schema.aiProviderConfigs.providerKey, parsed.data.providerKey));
  }
  await writeAuditLog({ actorId: user.id, action: "provider.update", entityType: "ai_provider_config", entityId: parsed.data.providerKey, after: { ...parsed.data, apiKey: "redacted" } });
  return { ok: true, message: "Proveedor actualizado y auditado." };
}

export async function pruneLocationRetentionAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = getDb();
  if (!db) {
    return { ok: true, message: "Politica de retencion validada en modo demo." };
  }
  await db.execute(sql`
    delete from delegate_location_pings p
    using location_tracking_settings s
    where p.user_id = s.user_id
      and p.captured_at < now() - (s.retention_days || ' days')::interval
  `);
  await writeAuditLog({ actorId: user.id, action: "geolocation.retention_prune", entityType: "delegate_location_ping", entityId: "bulk" });
  return { ok: true, message: "Retencion de ubicaciones aplicada." };
}

export async function exportReportAction(formData: FormData) {
  const user = await getCurrentUser();
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
