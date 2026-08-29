import { z } from "zod";
import { caseCategories, caseStatuses, eventTypes, priorities, promptScopes } from "@/lib/constants";

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
  enabled: z.coerce.boolean().default(true),
});

export const aiRunSchema = z.object({
  promptTemplateId: z.string().min(1),
  message: z.string().min(3).max(6000),
  relatedCaseId: z.string().optional(),
  relatedEventId: z.string().optional(),
  fieldCommissionId: z.string().optional(),
});

export const memberUpdateSchema = memberFormSchema.extend({
  id: z.string().min(1),
});

export const caseStatusSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(caseStatuses),
  priority: z.enum(priorities),
});

export const caseActionSchema = z.object({
  caseId: z.string().min(1),
  actionType: z.string().min(3, "Describe el tipo de accion."),
  description: z.string().min(5, "Describe la accion."),
  dueDate: z.string().optional(),
});

export const eventUpdateSchema = eventFormSchema.extend({
  id: z.string().min(1),
});

export const commissionUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["programada", "activa", "pausada", "completada", "cancelada"]),
  description: z.string().min(10),
});

export const prevalenceRecordSchema = z.object({
  studyId: z.string().min(1, "Selecciona estudio."),
  metricId: z.string().min(1, "Selecciona indicador."),
  territoryId: z.string().min(1, "Selecciona territorio."),
  valueNumeric: z.coerce.number().optional(),
  sampleSize: z.coerce.number().int().nonnegative().optional(),
  source: z.string().min(3, "Captura la fuente."),
  measuredAt: z.string().min(1, "Captura la fecha de medicion."),
});

export const organizationSchema = z.object({
  name: z.string().min(2, "Captura el nombre publico."),
  legalName: z.string().optional(),
  country: z.string().min(2),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal (#RRGGBB)."),
  geolocationEnabled: z.coerce.boolean().default(false),
  aiEnabled: z.coerce.boolean().default(false),
});

export const locationSettingSchema = z.object({
  id: z.string().min(1),
  enabled: z.coerce.boolean().default(false),
  mode: z.enum(["disabled", "manual_check_in", "during_commission", "active_shift"]),
  retentionDays: z.coerce.number().int().min(1).max(365),
});

export const providerSchema = z.object({
  id: z.string().min(1),
  enabled: z.coerce.boolean().default(false),
  defaultModel: z.string().min(2, "Captura el modelo por defecto."),
  priority: z.coerce.number().int().min(1).max(99),
  apiKey: z.string().optional(),
});
