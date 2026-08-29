// Dataset semilla de la plataforma. NO se sirve en memoria en tiempo de
// ejecucion: la aplicacion lee de Postgres. Este modulo es la fuente de datos
// que `drizzle/seed.ts` inserta en la base y que usan las pruebas.
import { aiProviders } from "@/lib/constants";
import type {
  AiConversation,
  AiPromptTemplate,
  AiProviderConfig,
  AuditLog,
  EventRecord,
  FieldCommission,
  HumanRightsCase,
  LocationTrackingSetting,
  Member,
  PrevalenceMetric,
  PrevalenceRecord,
  PrevalenceStudy,
  ReportDefinition,
  Territory,
  User,
} from "@/lib/types";

const now = "2026-08-29T12:00:00.000Z";

export const organization = {
  id: "org_demo",
  name: process.env.APP_NAME || "[PENDIENTE_NOMBRE]",
  legalName: "[PENDIENTE_RAZON_SOCIAL]",
  logoUrl: "",
  primaryColor: "#0f766e",
  country: "Mexico",
  geolocationEnabled: true,
  aiEnabled: true,
  locationRetentionDays: 30,
};

export const territories: Territory[] = [
  { id: "mx", type: "country", name: "Mexico", countryCode: "MX", latitude: 23.6345, longitude: -102.5528 },
  { id: "chh", type: "state", name: "Chihuahua", countryCode: "MX", stateCode: "CHH", parentId: "mx", latitude: 28.632996, longitude: -106.0691 },
  { id: "cdj", type: "city", name: "Ciudad Juarez", countryCode: "MX", stateCode: "CHH", cityName: "Ciudad Juarez", parentId: "chh", latitude: 31.6904, longitude: -106.4245 },
  { id: "chc", type: "city", name: "Chihuahua capital", countryCode: "MX", stateCode: "CHH", cityName: "Chihuahua", parentId: "chh", latitude: 28.6353, longitude: -106.0889 },
];

export const users: User[] = [
  { id: "u_admin", name: "Admin General", email: "admin@demo.org", phone: "6140000000", status: "active", roles: ["super_admin"], territoryId: "mx" },
  { id: "u_direccion", name: "Direccion Nacional", email: "direccion@demo.org", phone: "6140000001", status: "active", roles: ["national_direction"], territoryId: "mx" },
  { id: "u_estatal", name: "Coordinacion Chihuahua", email: "chihuahua@demo.org", phone: "6140000002", status: "active", roles: ["state_coordination"], territoryId: "chh" },
  { id: "u_municipal", name: "Coordinacion Juarez", email: "juarez@demo.org", phone: "6560000000", status: "active", roles: ["municipal_coordination"], territoryId: "cdj" },
  { id: "u_defensor", name: "Defensora de Casos", email: "casos@demo.org", phone: "6140000003", status: "active", roles: ["case_manager"], territoryId: "chh" },
  { id: "u_eventos", name: "Equipo de Eventos", email: "eventos@demo.org", phone: "6140000004", status: "active", roles: ["events_team"], territoryId: "chh" },
  { id: "u_auditor", name: "Auditoria Interna", email: "auditoria@demo.org", phone: "6140000005", status: "active", roles: ["auditor"], territoryId: "mx" },
  { id: "u_del_1", name: "Delegada Norte", email: "delegada.norte@demo.org", phone: "6560000001", status: "active", roles: ["territorial_delegate"], territoryId: "cdj" },
  { id: "u_del_2", name: "Delegado Centro", email: "delegado.centro@demo.org", phone: "6140000006", status: "active", roles: ["territorial_delegate"], territoryId: "chc" },
  { id: "u_del_3", name: "Delegada Estatal", email: "delegada.estatal@demo.org", phone: "6140000007", status: "active", roles: ["territorial_delegate"], territoryId: "chh" },
  { id: "u_com_1", name: "Comisionada Campo A", email: "comisionada.a@demo.org", phone: "6560000002", status: "active", roles: ["field_commissioner"], territoryId: "cdj" },
  { id: "u_com_2", name: "Comisionado Campo B", email: "comisionado.b@demo.org", phone: "6140000008", status: "active", roles: ["field_commissioner"], territoryId: "chc" },
  { id: "u_com_3", name: "Comisionada Campo C", email: "comisionada.c@demo.org", phone: "6140000009", status: "active", roles: ["field_commissioner"], territoryId: "chh" },
];

const names = [
  "Ana Martinez", "Luis Hernandez", "Sofia Rivera", "Carlos Torres", "Mariana Lopez",
  "Jose Ramirez", "Elena Castillo", "Miguel Flores", "Paola Gutierrez", "Diego Vargas",
  "Valeria Mendoza", "Roberto Salas", "Andrea Moreno", "Jorge Nunez", "Lucia Campos",
  "Fernando Vega", "Camila Rios", "Hector Paredes", "Natalia Ortega", "Ricardo Molina",
];

export const members: Member[] = names.map((name, index) => {
  const city = index % 2 === 0 ? "cdj" : "chc";
  return {
    id: `m_${String(index + 1).padStart(2, "0")}`,
    memberNumber: `ORG-CHH-${String(index + 1).padStart(6, "0")}`,
    userId: index < 5 ? users[index + 7]?.id : undefined,
    fullName: name,
    birthDate: `${1980 + (index % 25)}-0${(index % 9) + 1}-15`,
    gender: index % 3 === 0 ? "No especificado" : index % 2 === 0 ? "Femenino" : "Masculino",
    phone: `61412345${String(index).padStart(2, "0")}`,
    email: `miembro${index + 1}@demo.org`,
    address: `Direccion ficticia ${index + 1}, Chihuahua`,
    territoryId: city,
    status: index === 4 ? "pendiente" : index === 11 ? "suspendido" : "activo",
    joinedAt: `2026-${String((index % 8) + 1).padStart(2, "0")}-10T10:00:00.000Z`,
    credentialSlug: index === 0 ? "demo-chihuahua-001" : `credencial-demo-${index + 1}`,
    credentialStatus: index === 11 ? "suspendida" : "activa",
    credentialExpiresAt: "2027-08-29T00:00:00.000Z",
  };
});

const categories = [
  "Discriminacion",
  "Violencia institucional",
  "Negacion de servicios",
  "Vulneracion laboral",
  "Vulneracion educativa",
  "Accesibilidad",
  "Salud",
  "Documentacion y registro",
  "Seguimiento comunitario",
  "Otro",
];

export const cases: HumanRightsCase[] = categories.map((category, index) => ({
  id: `case_${index + 1}`,
  caseNumber: `CASO-2026-CHH-${String(index + 1).padStart(4, "0")}`,
  title: `${category} en institucion ${index + 1}`,
  description: "Expediente ficticio para validar captura, seguimiento, consentimiento, evidencia, prioridad y trazabilidad institucional.",
  category,
  priority: index % 4 === 0 ? "Urgente" : index % 3 === 0 ? "Alta" : index % 2 === 0 ? "Media" : "Baja",
  status: ["Nuevo", "En revision", "Aceptado", "En seguimiento", "En espera de tercero", "Resuelto", "Archivado"][index % 7],
  territoryId: index % 2 === 0 ? "cdj" : "chc",
  openedBy: "u_defensor",
  assignedTo: index % 2 === 0 ? "u_defensor" : "u_estatal",
  openedAt: `2026-0${(index % 8) + 1}-12T15:00:00.000Z`,
  dueDate: index < 5 ? `2026-09-${String(10 + index).padStart(2, "0")}T15:00:00.000Z` : undefined,
  persons: [
    {
      id: `cp_${index + 1}`,
      personType: "victima",
      name: `Persona protegida ${index + 1}`,
      contact: "contacto reservado",
      demographicData: { grupo: "poblacion objetivo", edad: `${24 + index}` },
      consentStatus: index % 2 === 0 ? "documentado" : "pendiente",
    },
  ],
  actions: [
    {
      id: `ca_${index + 1}`,
      actionType: index % 2 === 0 ? "Entrevista" : "Solicitud documental",
      description: "Accion de seguimiento ficticia con fecha compromiso.",
      dueDate: `2026-09-${String(12 + index).padStart(2, "0")}T12:00:00.000Z`,
      createdBy: "u_defensor",
    },
  ],
  evidence: [
    {
      id: `ce_${index + 1}`,
      fileUrl: "vercel-blob://evidencia-protegida-demo",
      fileType: "application/pdf",
      description: "Evidencia ficticia protegida",
      uploadedBy: "u_defensor",
      createdAt: now,
    },
  ],
  internalNotes: ["Nota interna ficticia: validar datos antes de escalar."],
}));

export const events: EventRecord[] = Array.from({ length: 5 }).map((_, index) => ({
  id: `event_${index + 1}`,
  title: ["Foro estatal de derechos humanos", "Brigada comunitaria", "Taller de accesibilidad", "Reunion institucional", "Jornada de incidencia"][index],
  description: "Evento ficticio documentado con asistentes, evidencias, ubicacion e impacto institucional.",
  eventType: ["Foro", "Brigada", "Taller", "Reunion institucional", "Actividad de incidencia"][index],
  dateStart: `2026-0${index + 3}-20T10:00:00.000Z`,
  dateEnd: `2026-0${index + 3}-20T14:00:00.000Z`,
  location: index % 2 === 0 ? "Ciudad Juarez, Chihuahua" : "Chihuahua, Chihuahua",
  territoryId: index % 2 === 0 ? "cdj" : "chc",
  organizerId: "u_eventos",
  attendeesCount: [120, 80, 45, 18, 220][index],
  institutions: ["Institucion demo", "Aliado comunitario"],
  impactSummary: "Se documenta alcance, acuerdos, participacion e indicadores impactados.",
  indicators: ["Personas atendidas", "Instituciones contactadas"],
  evidence: [
    {
      id: `ee_${index + 1}`,
      fileUrl: "vercel-blob://evento-demo",
      fileType: "image/jpeg",
      description: "Fotografia ficticia de evidencia institucional",
      uploadedBy: "u_eventos",
      createdAt: now,
    },
  ],
}));

export const prevalenceStudies: PrevalenceStudy[] = [
  {
    id: "study_1",
    name: "Medicion territorial 2026",
    description: "Estudio ficticio para visualizar prevalencia, atencion, eventos y presencia por territorio.",
    methodology: "Levantamiento comunitario con registros internos, muestra territorial y fuentes documentadas.",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    status: "activo",
  },
];

export const prevalenceMetrics: PrevalenceMetric[] = [
  ["personas_atendidas", "Personas atendidas", "numerico"],
  ["casos_100k", "Casos registrados por cada 100,000 habitantes", "tasa"],
  ["casos_categoria", "Casos por categoria", "conteo"],
  ["poblacion_objetivo", "Poblacion objetivo estimada", "numerico"],
  ["prevalencia_estimada", "Prevalencia estimada", "porcentaje"],
  ["eventos_realizados", "Eventos realizados", "conteo"],
  ["miembros_activos", "Miembros activos", "conteo"],
  ["instituciones_contactadas", "Instituciones contactadas", "conteo"],
  ["resoluciones_favorables", "Resoluciones favorables", "porcentaje"],
  ["casos_urgentes", "Casos urgentes", "conteo"],
].map(([indicatorKey, label, valueType], index) => ({
  id: `metric_${index + 1}`,
  studyId: "study_1",
  indicatorKey,
  label,
  description: `Indicador semilla: ${label}`,
  valueType: valueType as PrevalenceMetric["valueType"],
}));

export const prevalenceRecords: PrevalenceRecord[] = prevalenceMetrics.flatMap((metric, index) => [
  {
    id: `record_${index + 1}_cdj`,
    studyId: "study_1",
    metricId: metric.id,
    territoryId: "cdj",
    valueNumeric: [450, 18.5, 32, 12000, 6.8, 12, 230, 35, 42, 8][index],
    sampleSize: 620,
    source: "Registro ficticio Ciudad Juarez",
    measuredAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: `record_${index + 1}_chc`,
    studyId: "study_1",
    metricId: metric.id,
    territoryId: "chc",
    valueNumeric: [320, 14.2, 25, 9000, 5.1, 9, 190, 28, 38, 5][index],
    sampleSize: 510,
    source: "Registro ficticio Chihuahua capital",
    measuredAt: "2026-08-01T00:00:00.000Z",
  },
]);

export const locationSettings: LocationTrackingSetting[] = users
  .filter((user) => user.roles.includes("territorial_delegate") || user.roles.includes("field_commissioner"))
  .map((user, index) => ({
    id: `lts_${index + 1}`,
    userId: user.id,
    enabled: index !== 5,
    mode: index % 2 === 0 ? "manual_check_in" : "during_commission",
    allowedDays: ["lunes", "martes", "miercoles", "jueves", "viernes"],
    allowedHours: { from: "08:00", to: "18:00" },
    retentionDays: 30,
    disabledReason: index === 5 ? "Pausa temporal documentada" : undefined,
    updatedBy: "u_admin",
    updatedAt: now,
  }));

export const fieldCommissions: FieldCommission[] = Array.from({ length: 5 }).map((_, index) => {
  const assignedTo = ["u_com_1", "u_com_2", "u_com_3", "u_del_1", "u_del_2"][index];
  const territoryId = index % 2 === 0 ? "cdj" : "chc";
  return {
    id: `fc_${index + 1}`,
    title: ["Visita institucional", "Brigada de atencion", "Revision de accesibilidad", "Acompanamiento urgente", "Levantamiento comunitario"][index],
    commissionType: ["visita", "brigada", "revision", "urgente", "levantamiento"][index],
    description: "Comision ficticia con controles de privacidad, check-ins y evidencia de presencia territorial.",
    assignedTo,
    territoryId,
    relatedCaseId: index < 3 ? cases[index].id : undefined,
    relatedEventId: index >= 3 ? events[index - 3].id : undefined,
    status: index === 1 ? "activa" : index === 4 ? "pausada" : "programada",
    scheduledAt: `2026-09-${String(index + 5).padStart(2, "0")}T09:00:00.000Z`,
    completedAt: undefined,
    checkIns: [
      {
        id: `ping_${index + 1}`,
        userId: assignedTo,
        fieldCommissionId: `fc_${index + 1}`,
        territoryId,
        latitude: territoryId === "cdj" ? 31.6904 + index / 100 : 28.6353 + index / 100,
        longitude: territoryId === "cdj" ? -106.4245 - index / 100 : -106.0889 - index / 100,
        accuracyMeters: 35 + index * 4,
        captureMode: index % 2 === 0 ? "manual" : "commission",
        batteryLevel: 76 - index * 5,
        status: index === 4 ? "pausado" : index === 1 ? "en_comision" : "disponible",
        capturedAt: `2026-08-29T${String(8 + index).padStart(2, "0")}:30:00.000Z`,
      },
    ],
  };
});

export const aiProviderConfigs: AiProviderConfig[] = aiProviders.map((provider, index) => ({
  id: `provider_${provider.key}`,
  providerKey: provider.key,
  displayName: provider.displayName,
  enabled: Boolean(process.env[provider.env]),
  defaultModel: process.env.AI_DEFAULT_PROVIDER === provider.key ? process.env.AI_DEFAULT_MODEL || provider.defaultModel : provider.defaultModel,
  encryptedApiKeyRef: provider.env,
  priority: index + 1,
  updatedBy: "u_admin",
  updatedAt: now,
}));

const promptSeed: Array<[string, string, AiPromptTemplate["moduleScope"], string]> = [
  ["orientacion_delegado", "Orientacion de delegado", "general", "Ordena una situacion territorial y sugiere pasos internos."],
  ["checklist_comision", "Checklist de comision", "comision", "Prepara una visita, brigada o reunion."],
  ["resumen_caso", "Resumen de caso", "caso", "Convierte expediente en resumen ejecutivo interno."],
  ["campos_faltantes_caso", "Campos faltantes de caso", "caso", "Detecta informacion incompleta antes de escalar."],
  ["reporte_visita", "Reporte de visita", "comision", "Transforma notas de campo en reporte institucional."],
  ["reporte_evento", "Reporte de evento", "evento", "Genera borrador de ficha de evento realizado."],
  ["analisis_territorial", "Analisis territorial", "prevalencia", "Resume miembros, casos, eventos y prevalencia por territorio."],
  ["comunicacion_institucional", "Comunicacion institucional", "reporte", "Crea mensajes formales revisables."],
];

export const aiPromptTemplates: AiPromptTemplate[] = promptSeed.map(([key, name, moduleScope, description], index) => ({
  id: `prompt_${index + 1}`,
  key,
  name,
  description,
  moduleScope,
  systemPrompt:
    "Eres un asistente institucional de derechos humanos. Ayudas a ordenar informacion y crear borradores revisables. No inventes datos, no ocultes evidencia y no emitas asesoria legal concluyente.",
  userPromptTemplate:
    "Contexto permitido: {{contexto}}. Solicitud del usuario: {{mensaje}}. Entrega una respuesta estructurada, prudente y verificable.",
  variables: ["contexto", "mensaje", "territorio", "rol"],
  providerKey: "global",
  model: undefined,
  temperature: 0.3,
  enabled: true,
  version: 1,
  updatedBy: "u_admin",
  updatedAt: now,
}));

export const aiConversations: AiConversation[] = Array.from({ length: 10 }).map((_, index) => ({
  id: `conv_${index + 1}`,
  userId: users[index % users.length].id,
  relatedCaseId: index < 5 ? cases[index].id : undefined,
  relatedEventId: index >= 5 && index < 8 ? events[index - 5].id : undefined,
  fieldCommissionId: index >= 8 ? fieldCommissions[index - 8].id : undefined,
  promptTemplateId: aiPromptTemplates[index % aiPromptTemplates.length].id,
  title: `Conversacion IA ficticia ${index + 1}`,
  status: "activa",
  createdAt: now,
  messages: [
    {
      id: `msg_user_${index + 1}`,
      conversationId: `conv_${index + 1}`,
      role: "user",
      content: "Ayudame a ordenar esta informacion ficticia.",
      createdAt: now,
    },
    {
      id: `msg_ai_${index + 1}`,
      conversationId: `conv_${index + 1}`,
      role: "assistant",
      content: "Borrador revisable generado con datos ficticios y advertencia de validacion humana.",
      metadata: { provider: "simulado", model: "seed" },
      createdAt: now,
    },
  ],
}));

export const auditLogs: AuditLog[] = [
  "login.success",
  "member.create",
  "credential.issue",
  "case.status_change",
  "event.create",
  "report.export",
  "geolocation.check_in",
  "geolocation.map_view",
  "commission.assign",
  "ai.prompt_update",
  "ai.run",
  "provider.update",
].map((action, index) => ({
  id: `audit_${index + 1}`,
  actorId: users[index % users.length].id,
  action,
  entityType: action.split(".")[0],
  entityId: `demo_${index + 1}`,
  after: { status: "ok", ficticio: true },
  ip: "127.0.0.1",
  createdAt: `2026-08-29T${String(8 + index).padStart(2, "0")}:00:00.000Z`,
}));

export const reports: ReportDefinition[] = [
  { id: "rep_members", title: "Miembros por territorio", type: "members", filters: ["territorio", "estatus", "fecha"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_cases", title: "Casos por categoria y estado", type: "cases", filters: ["categoria", "estado", "prioridad"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_urgent", title: "Casos urgentes", type: "urgent_cases", filters: ["territorio", "responsable"], internal: false, formats: ["PDF"] },
  { id: "rep_events", title: "Eventos por periodo", type: "events", filters: ["periodo", "tipo", "territorio"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_reach", title: "Alcance territorial", type: "territory_reach", filters: ["pais", "estado", "ciudad"], internal: false, formats: ["PDF"] },
  { id: "rep_prevalence", title: "Prevalencia por indicador", type: "prevalence", filters: ["indicador", "periodo", "territorio"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_checkins", title: "Comisiones y check-ins", type: "field_operations", filters: ["comision", "usuario", "periodo"], internal: true, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_ai", title: "Uso del asistente IA", type: "ai_usage", filters: ["proveedor", "modulo", "usuario"], internal: true, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_case_pdf", title: "Ficha PDF de caso", type: "case_pdf", filters: ["caso"], internal: true, formats: ["PDF"] },
  { id: "rep_event_pdf", title: "Ficha PDF de evento", type: "event_pdf", filters: ["evento"], internal: false, formats: ["PDF"] },
];

export const allLocationPings = fieldCommissions.flatMap((commission) => commission.checkIns);
