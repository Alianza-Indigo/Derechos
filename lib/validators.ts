import { z } from "zod";
import { caseCategories, caseStatuses, eventTypes, priorities, promptScopes } from "@/lib/constants";

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
  territoryId: z.string().min(1, "Selecciona territorio."),
  status: z.enum(["pendiente", "activo", "suspendido", "baja", "fallecido"]),
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

export const caseStatusUpdateSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(caseStatuses),
  reason: z.string().min(10, "El motivo del cambio de estado es obligatorio."),
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

export const locationSettingSchema = z.object({
  id: z.string().min(1),
  enabled: formBoolean,
  mode: z.enum(["disabled", "manual_check_in", "during_commission", "active_shift"]),
  retentionDays: z.coerce.number().int().min(1).max(365),
});

export const providerConfigSchema = z.object({
  providerKey: z.enum(["gemini", "openai", "anthropic"]),
  enabled: formBoolean,
  defaultModel: z.string().min(2),
  priority: z.coerce.number().int().min(1).max(99),
  apiKey: z.string().optional(),
});

export const eventFormSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  eventType: z.enum(eventTypes),
  dateStart: z.string().min(1),
  dateEnd: z.string().min(1),
  location: z.string().min(3),
  territoryId: z.string().min(1),
  attendeesCount: z.coerce.number().int().nonnegative(),
  impactSummary: z.string().min(10),
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
