import { z } from "zod";
import { caseCategories, caseStatuses, eventTypes, priorities, promptScopes } from "@/lib/constants";
import type { RoleKey } from "@/lib/types";

const roleKeyValues = [
  "super_admin",
  "national_direction",
  "state_coordination",
  "municipal_coordination",
  "territorial_delegate",
  "field_commissioner",
  "case_manager",
  "events_team",
  "data_entry",
  "member",
  "auditor",
] as const satisfies readonly RoleKey[];

const formBoolean = z.union([z.boolean(), z.enum(["true", "false", "on", "1", "0"])]).transform((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  return value === "true" || value === "on" || value === "1";
});

export const memberFormSchema = z.object({
  fullName: z.string().min(3, "Captura el nombre completo."),
  birthDate: z.string().min(4, "Captura fecha de nacimiento."),
  gender: z.string().min(1, "Selecciona genero."),
  phone: z.string().min(7, "Captura telefono valido."),
  email: z.email("Captura correo valido."),
  address: z.string().min(5, "Captura domicilio o referencia."),
  position: z.string().optional(),
  territoryId: z.string().min(1, "Selecciona territorio."),
  status: z.enum(["pendiente", "activo", "suspendido", "baja", "fallecido"]),
});

export const memberPositionSchema = z.object({
  memberId: z.string().min(1),
  position: z.string().max(120).optional(),
});

export const caseFormSchema = z.object({
  title: z.string().min(5, "Describe el titulo del caso."),
  description: z.string().min(20, "La descripcion debe permitir valorar el caso."),
  category: z.enum(caseCategories),
  priority: z.enum(priorities),
  status: z.enum(caseStatuses),
  territoryId: z.string().min(1),
  assignedTo: z.string().min(1),
  consentStatus: z.enum(["documentado", "pendiente", "no_aplica"]),
});

// Formato de admision de caso: datos del caso + hechos + persona afectada +
// quien reporta (opcional) + autoridad senalada (opcional).
export const caseIntakeSchema = z.object({
  // Caso
  title: z.string().min(5, "Describe el titulo del caso."),
  category: z.enum(caseCategories),
  priority: z.enum(priorities),
  status: z.enum(caseStatuses),
  territoryId: z.string().min(1, "Selecciona territorio."),
  assignedTo: z.string().min(1, "Selecciona responsable."),
  description: z.string().min(20, "Describe los hechos con detalle suficiente."),
  // Hechos
  incidentDate: z.string().optional(),
  incidentLocation: z.string().optional(),
  rightViolated: z.string().optional(),
  // Persona afectada
  victimName: z.string().min(2, "Captura el nombre de la persona afectada (o 'Reservado')."),
  victimContact: z.string().optional(),
  victimGender: z.string().optional(),
  victimAgeGroup: z.string().optional(),
  consentStatus: z.enum(["documentado", "pendiente", "no_aplica"]),
  // Quien reporta (si es distinto de la persona afectada)
  reporterName: z.string().optional(),
  reporterContact: z.string().optional(),
  reporterRelation: z.string().optional(),
  // Autoridad / institucion senalada
  authorityName: z.string().optional(),
});

export const caseStatusUpdateSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(caseStatuses),
  reason: z.string().min(10, "El motivo del cambio de estado es obligatorio."),
});

export const casePersonSchema = z.object({
  caseId: z.string().min(1),
  personType: z.enum(["victima", "solicitante", "autoridad", "testigo", "otro"]),
  name: z.string().min(2, "Captura el nombre."),
  contact: z.string().min(1, "Captura un contacto o 'Reservado'."),
  consentStatus: z.enum(["documentado", "pendiente", "no_aplica"]),
});

export const caseTimelineActionSchema = z.object({
  caseId: z.string().min(1),
  actionType: z.string().min(3, "Describe el tipo de accion."),
  description: z.string().min(5, "Describe la accion."),
  dueDate: z.string().optional(),
});

export const evidenceFormSchema = z.object({
  entityType: z.enum(["case", "event"]),
  entityId: z.string().min(1),
  fileUrl: z.string().min(3),
  fileType: z.string().min(3),
  description: z.string().min(5),
});

export const prevalenceRecordSchema = z.object({
  studyId: z.string().min(1),
  metricId: z.string().min(1),
  territoryId: z.string().min(1),
  valueNumeric: z.coerce.number().optional(),
  valueText: z.string().optional(),
  sampleSize: z.coerce.number().int().nonnegative().optional(),
  source: z.string().min(3),
  measuredAt: z.string().min(1),
});

export const organizationSchema = z.object({
  name: z.string().min(2, "Captura el nombre publico."),
  legalName: z.string().optional(),
  country: z.string().min(2, "Captura el pais base."),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal (#RRGGBB)."),
  geolocationEnabled: formBoolean,
  aiEnabled: formBoolean,
});

// Alta de una organizacion (tenant) desde la consola de plataforma: crea la
// organizacion y su primer administrador (rol super_admin de alcance global).
export const organizationCreateSchema = z.object({
  name: z.string().min(2, "Captura el nombre publico."),
  legalName: z.string().optional(),
  country: z.string().min(2, "Captura el pais base."),
  slug: z
    .string()
    .min(2, "El identificador (slug) debe tener al menos 2 caracteres.")
    .max(40, "El identificador (slug) es demasiado largo.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minusculas, numeros y guiones."),
  code: z
    .string()
    .min(2, "El codigo debe tener al menos 2 caracteres.")
    .max(8, "El codigo debe tener maximo 8 caracteres.")
    .regex(/^[A-Z0-9]+$/, "El codigo solo admite mayusculas y numeros."),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal (#RRGGBB).").optional(),
  plan: z.enum(["gratuito", "pro", "institucional"]).optional(),
  adminName: z.string().min(2, "Captura el nombre del administrador."),
  adminEmail: z.string().email("Correo del administrador invalido."),
  adminPassword: z.string().min(8, "La contrasena del administrador debe tener al menos 8 caracteres."),
});

export const organizationStatusSchema = z.object({
  organizationId: z.string().min(1),
  status: z.enum(["active", "suspended"]),
});

export const organizationPlanSchema = z.object({
  organizationId: z.string().min(1),
  plan: z.enum(["gratuito", "pro", "institucional"]),
});

export const organizationDomainSchema = z.object({
  organizationId: z.string().min(1),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Dominio invalido (ej. derechos.miorg.org).")
    .optional()
    .or(z.literal("")),
});

// Auto-registro publico de una organizacion. No incluye plan (siempre inicia en
// el plan gratuito) ni estado (inicia pendiente de aprobacion).
export const organizationSignupSchema = z.object({
  name: z.string().min(2, "Captura el nombre de la organizacion."),
  legalName: z.string().optional(),
  country: z.string().min(2, "Captura el pais base."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "El identificador (slug) debe tener al menos 2 caracteres.")
    .max(40, "El identificador (slug) es demasiado largo.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minusculas, numeros y guiones."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "El codigo debe tener al menos 2 caracteres.")
    .max(8, "El codigo debe tener maximo 8 caracteres.")
    .regex(/^[A-Z0-9]+$/, "El codigo solo admite mayusculas y numeros."),
  adminName: z.string().min(2, "Captura tu nombre."),
  adminEmail: z.string().email("Correo invalido."),
  adminPassword: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const locationSettingSchema = z.object({
  id: z.string().min(1),
  enabled: formBoolean,
  mode: z.enum(["disabled", "manual_check_in", "during_commission", "active_shift"]),
  retentionDays: z.coerce.number().int().min(1).max(365),
});

export const locationPauseSchema = z.object({
  paused: formBoolean,
  reason: z.string().optional(),
});

export const territoryLocationSchema = z.object({
  territoryId: z.string().min(1),
  enabled: formBoolean,
  mode: z.enum(["disabled", "manual_check_in", "during_commission", "active_shift"]),
  retentionDays: z.coerce.number().int().min(1).max(365),
});

export const studySchema = z.object({
  name: z.string().min(3, "Captura el nombre del estudio."),
  description: z.string().min(5, "Captura una descripcion."),
  methodology: z.string().min(5, "Captura la metodologia."),
  startDate: z.string().min(1, "Captura la fecha de inicio."),
  endDate: z.string().min(1, "Captura la fecha de fin."),
  status: z.enum(["borrador", "activo", "cerrado"]),
});

export const metricSchema = z.object({
  studyId: z.string().min(1, "Selecciona el estudio."),
  indicatorKey: z.string().regex(/^[a-z0-9_]+$/, "Usa minusculas, numeros y guion bajo."),
  label: z.string().min(3, "Captura la etiqueta."),
  description: z.string().min(3, "Captura la descripcion."),
  valueType: z.enum(["numerico", "tasa", "conteo", "porcentaje", "texto"]),
});

export const providerConfigSchema = z.object({
  providerKey: z.enum(["gemini", "openai", "anthropic"]),
  enabled: formBoolean,
  defaultModel: z.string().min(2),
  priority: z.coerce.number().int().min(1).max(99),
  apiKey: z.string().optional(),
});

const csvList = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []));

export const eventFormSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  eventType: z.enum(eventTypes),
  dateStart: z.string().min(1),
  dateEnd: z.string().min(1),
  location: z.string().min(3),
  objective: z.string().optional(),
  territoryId: z.string().min(1),
  attendeesCount: z.coerce.number().int().nonnegative(),
  impactSummary: z.string().min(10),
  institutions: csvList,
  indicators: csvList,
});

export const commissionFormSchema = z.object({
  title: z.string().min(5),
  commissionType: z.string().min(3),
  description: z.string().min(10),
  assignedTo: z.string().min(1),
  territoryId: z.string().min(1),
  scheduledAt: z.string().min(1),
});

export const checkInSchema = z.object({
  fieldCommissionId: z.string().optional(),
  territoryId: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).default(50),
  captureMode: z.enum(["manual", "commission", "shift"]).default("manual"),
  batteryLevel: z.coerce.number().min(0).max(100).optional(),
});

export const promptTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(3),
  description: z.string().min(10),
  moduleScope: z.enum(promptScopes),
  systemPrompt: z.string().min(20),
  userPromptTemplate: z.string().min(10),
  variables: z.string().transform((value) => JSON.parse(value) as string[]),
  providerKey: z.enum(["global", "gemini", "openai", "anthropic"]),
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(1),
  enabled: formBoolean.default(true),
});

export const aiRunSchema = z.object({
  promptTemplateId: z.string().min(1),
  message: z.string().min(3).max(6000),
  relatedCaseId: z.string().optional(),
  relatedEventId: z.string().optional(),
  fieldCommissionId: z.string().optional(),
});

export const aiFeedbackSchema = z.object({
  aiRunId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const credentialActionSchema = z.object({
  memberId: z.string().min(1),
  action: z.enum(["revoke", "renew", "suspend"]),
});

export const memberReportSchema = z.object({
  title: z.string().min(5, "Describe brevemente el motivo del reporte."),
  category: z.enum(caseCategories),
  description: z.string().min(20, "Describe los hechos con el mayor detalle posible."),
  incidentDate: z.string().optional(),
  incidentLocation: z.string().optional(),
  rightViolated: z.string().optional(),
  // Datos de la persona afectada (aplican a ti o a la persona por la que reportas).
  victimGender: z.string().optional(),
  victimAgeGroup: z.string().optional(),
  // ¿Reporta por otra persona? Si es asi, se capturan los datos de la persona
  // afectada; de lo contrario la persona afectada es el propio miembro.
  onBehalf: formBoolean.default(false),
  affectedName: z.string().optional(),
  affectedContact: z.string().optional(),
  affectedRelation: z.string().optional(),
  // Autoridad o institucion senalada.
  authorityName: z.string().optional(),
  consentStatus: z.enum(["documentado", "pendiente", "no_aplica"]).default("pendiente"),
});

export const memberProfileSchema = z.object({
  phone: z.string().min(7, "Captura un telefono valido."),
  email: z.email("Captura un correo valido."),
  address: z.string().min(5, "Captura tu domicilio o referencia."),
});

export const memberStatusSchema = z.object({
  memberId: z.string().min(1),
  status: z.enum(["pendiente", "activo", "suspendido", "baja", "fallecido"]),
});

export const memberDeleteSchema = z.object({
  memberId: z.string().min(1),
  confirm: z.literal("ELIMINAR"),
});

export const memberPhotoSchema = z.object({
  memberId: z.string().optional(),
  photoUrl: z.string().min(3, "Sube una fotografia valida."),
});

export const memberAccessSchema = z.object({
  memberId: z.string().min(1),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const caseReassignSchema = z.object({
  caseId: z.string().min(1),
  assignedTo: z.string().min(1, "Selecciona un responsable."),
});

export const userFormSchema = z.object({
  name: z.string().min(3, "Captura el nombre completo."),
  email: z.email("Captura un correo valido."),
  phone: z.string().optional(),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
  role: z.enum(roleKeyValues),
  territoryId: z.string().optional(),
  status: z.enum(["active", "disabled", "pending"]).default("active"),
});

export const userStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["active", "disabled", "pending"]),
});

export const roleAssignmentSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(roleKeyValues),
  territoryId: z.string().optional(),
});

export const roleRemovalSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(roleKeyValues),
  scopeType: z.enum(["global", "territory"]),
  scopeId: z.string().optional(),
});

export const locationPurgeSchema = z.object({
  scope: z.enum(["all", "territory", "user"]),
  territoryId: z.string().optional(),
  userId: z.string().optional(),
  before: z.string().optional(),
});

export type MemberFilters = {
  q?: string;
  territoryId?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type PrevalenceFilters = {
  studyId?: string;
  metricId?: string;
  territoryId?: string;
  from?: string;
  to?: string;
};
