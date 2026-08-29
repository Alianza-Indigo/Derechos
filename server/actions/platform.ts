"use server";

import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import {
  aiPromptTemplates,
  cases,
  casePeople,
  delegateLocationPings,
  events,
  fieldCommissions,
  memberCredentials,
  members,
} from "@/drizzle/schema";
import { runAssistant } from "@/lib/ai/adapters";
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
import { getDb } from "@/server/db";
import { getCurrentUser, getPromptRecordById, nextCaseNumber, nextMemberNumber } from "@/server/queries/app";

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
  const duplicate = await db
    .select({ id: members.id })
    .from(members)
    .where(or(eq(members.email, parsed.data.email), eq(members.phone, parsed.data.phone)));
  if (duplicate.length) {
    return { ok: false, message: "Ya existe un miembro con ese correo o telefono." };
  }

  const slug = `credencial-${crypto.randomUUID().slice(0, 8)}`;
  const [inserted] = await db
    .insert(members)
    .values({
      memberNumber: await nextMemberNumber(),
      fullName: parsed.data.fullName,
      birthDate: new Date(parsed.data.birthDate),
      gender: parsed.data.gender,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
      territoryId: parsed.data.territoryId,
      status: parsed.data.status,
    })
    .returning({ id: members.id });

  await db.insert(memberCredentials).values({
    memberId: inserted.id,
    qrToken: crypto.randomUUID(),
    publicSlug: slug,
    expiresAt: nextYear(),
    status: parsed.data.status === "activo" ? "activa" : "suspendida",
  });

  await writeAuditLog({ actorId: user.id, action: "member.create", entityType: "member", entityId: inserted.id, after: parsed.data });
  await writeAuditLog({ actorId: user.id, action: "credential.issue", entityType: "member_credential", entityId: slug, after: { publicSlug: slug } });
  redirect(`/miembros/${inserted.id}`);
}

export async function createCaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = caseFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const [inserted] = await db
    .insert(cases)
    .values({
      caseNumber: await nextCaseNumber(),
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: parsed.data.status,
      territoryId: parsed.data.territoryId,
      openedBy: user.id,
      assignedTo: parsed.data.assignedTo,
      internalNotes: ["Caso creado desde formulario institucional."],
    })
    .returning({ id: cases.id });

  await db.insert(casePeople).values({
    caseId: inserted.id,
    personType: "solicitante",
    name: "Persona protegida",
    contact: "Reservado",
    demographicData: {},
    consentStatus: parsed.data.consentStatus,
  });

  await writeAuditLog({ actorId: user.id, action: "case.create", entityType: "case", entityId: inserted.id, after: parsed.data });
  redirect(`/casos/${inserted.id}`);
}

export async function createEventAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = eventFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const [inserted] = await db
    .insert(events)
    .values({
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
    })
    .returning({ id: events.id });

  await writeAuditLog({ actorId: user.id, action: "event.create", entityType: "event", entityId: inserted.id, after: parsed.data });
  redirect(`/eventos/${inserted.id}`);
}

export async function createCommissionAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = commissionFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }

  const db = getDb();
  const [inserted] = await db
    .insert(fieldCommissions)
    .values({
      title: parsed.data.title,
      commissionType: parsed.data.commissionType,
      description: parsed.data.description,
      assignedTo: parsed.data.assignedTo,
      territoryId: parsed.data.territoryId,
      status: "programada",
      scheduledAt: new Date(parsed.data.scheduledAt),
    })
    .returning({ id: fieldCommissions.id });

  await writeAuditLog({ actorId: user.id, action: "commission.assign", entityType: "field_commission", entityId: inserted.id, after: parsed.data });
  redirect(`/operacion-territorial/comisiones/${inserted.id}`);
}

export async function createCheckInAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = checkInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Ubicacion invalida." };
  }

  const db = getDb();
  const [inserted] = await db
    .insert(delegateLocationPings)
    .values({
      userId: user.id,
      fieldCommissionId: parsed.data.fieldCommissionId || null,
      territoryId: parsed.data.territoryId,
      latitude: String(parsed.data.latitude),
      longitude: String(parsed.data.longitude),
      accuracyMeters: parsed.data.accuracyMeters,
      captureMode: parsed.data.captureMode,
      batteryLevel: parsed.data.batteryLevel ?? null,
      status: parsed.data.captureMode === "commission" ? "en_comision" : "disponible",
    })
    .returning({ id: delegateLocationPings.id });

  await writeAuditLog({
    actorId: user.id,
    action: "geolocation.check_in",
    entityType: "delegate_location_ping",
    entityId: inserted.id,
    after: { ...parsed.data, latitude: "redacted", longitude: "redacted" },
  });
  return { ok: true, message: "Check-in registrado con ubicacion autorizada y auditoria." };
}

export async function runAssistantAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = aiRunSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Solicitud invalida." };
  }
  const prompt = await getPromptRecordById(parsed.data.promptTemplateId);
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

  const db = getDb();
  const existing = await db.select({ id: aiPromptTemplates.id }).from(aiPromptTemplates).where(eq(aiPromptTemplates.key, parsed.data.key));

  await db.insert(aiPromptTemplates).values({
    key: parsed.data.key,
    name: parsed.data.name,
    description: parsed.data.description,
    moduleScope: parsed.data.moduleScope,
    systemPrompt: parsed.data.systemPrompt,
    userPromptTemplate: parsed.data.userPromptTemplate,
    variables: parsed.data.variables,
    providerKey: parsed.data.providerKey,
    model: parsed.data.model || null,
    temperature: String(parsed.data.temperature),
    enabled: parsed.data.enabled,
    version: existing.length + 1,
    updatedBy: user.id,
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
  return date;
}
