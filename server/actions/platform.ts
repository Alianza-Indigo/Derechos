"use server";

import { redirect } from "next/navigation";
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
  checkInSchema,
  commissionFormSchema,
  eventFormSchema,
  memberFormSchema,
  promptTemplateSchema,
} from "@/lib/validators";
import { writeAuditLog } from "@/server/audit/log";
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
  const prompt = aiPromptTemplates.find((item) => item.id === parsed.data.promptTemplateId);
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

  return { ok: true, message: `Respuesta generada con ${result.provider}/${result.model}.`, output: result.output };
}

export async function savePromptAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = promptTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Prompt invalido." };
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
