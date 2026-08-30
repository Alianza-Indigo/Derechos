export type RoleKey =
  | "super_admin"
  | "national_direction"
  | "state_coordination"
  | "municipal_coordination"
  | "territorial_delegate"
  | "field_commissioner"
  | "case_manager"
  | "events_team"
  | "data_entry"
  | "member"
  | "auditor";

export type TerritoryType = "country" | "state" | "city";

export type Territory = {
  id: string;
  type: TerritoryType;
  name: string;
  countryCode: string;
  stateCode?: string;
  cityName?: string;
  parentId?: string;
  latitude: number;
  longitude: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: "active" | "disabled" | "pending";
  roles: RoleKey[];
  territoryId?: string;
};

export type Member = {
  id: string;
  memberNumber: string;
  userId?: string;
  fullName: string;
  birthDate: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  photoUrl?: string;
  position?: string;
  territoryId: string;
  status: "pendiente" | "activo" | "suspendido" | "baja" | "fallecido";
  joinedAt: string;
  credentialSlug: string;
  credentialStatus: "activa" | "suspendida" | "vencida" | "revocada";
  credentialExpiresAt: string;
};

export type HumanRightsCase = {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: string;
  priority: "Baja" | "Media" | "Alta" | "Urgente";
  status: string;
  territoryId: string;
  openedBy: string;
  assignedTo: string;
  openedAt: string;
  closedAt?: string;
  dueDate?: string;
  incidentDate?: string;
  incidentLocation?: string;
  rightViolated?: string;
  persons: CasePerson[];
  actions: CaseAction[];
  evidence: Evidence[];
  internalNotes: string[];
};

export type CasePerson = {
  id: string;
  personType: "victima" | "solicitante" | "autoridad" | "testigo" | "otro";
  name: string;
  contact: string;
  demographicData: Record<string, string>;
  consentStatus: "documentado" | "pendiente" | "no_aplica";
};

export type CaseAction = {
  id: string;
  actionType: string;
  description: string;
  dueDate?: string;
  completedAt?: string;
  createdBy: string;
};

export type Evidence = {
  id: string;
  fileUrl: string;
  fileType: string;
  description: string;
  uploadedBy: string;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  objective?: string;
  territoryId: string;
  organizerId: string;
  attendeesCount: number;
  institutions: string[];
  impactSummary: string;
  indicators: string[];
  evidence: Evidence[];
};

export type PrevalenceStudy = {
  id: string;
  name: string;
  description: string;
  methodology: string;
  startDate: string;
  endDate: string;
  status: "borrador" | "activo" | "cerrado";
};

export type PrevalenceMetric = {
  id: string;
  studyId: string;
  indicatorKey: string;
  label: string;
  description: string;
  valueType: "numerico" | "tasa" | "conteo" | "porcentaje" | "texto";
};

export type PrevalenceRecord = {
  id: string;
  studyId: string;
  metricId: string;
  territoryId: string;
  valueNumeric?: number;
  valueText?: string;
  sampleSize?: number;
  source: string;
  measuredAt: string;
};

export type FieldCommission = {
  id: string;
  title: string;
  commissionType: string;
  description: string;
  assignedTo: string;
  territoryId: string;
  relatedCaseId?: string;
  relatedEventId?: string;
  status: "programada" | "activa" | "pausada" | "completada" | "cancelada";
  scheduledAt: string;
  completedAt?: string;
  checkIns: DelegateLocationPing[];
};

export type LocationTrackingSetting = {
  id: string;
  userId: string;
  enabled: boolean;
  mode: "disabled" | "manual_check_in" | "during_commission" | "active_shift";
  allowedDays: string[];
  allowedHours: { from: string; to: string };
  retentionDays: number;
  disabledReason?: string;
  updatedBy: string;
  updatedAt: string;
};

export type DelegateLocationPing = {
  id: string;
  userId: string;
  fieldCommissionId?: string;
  territoryId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  captureMode: "manual" | "commission" | "shift";
  batteryLevel?: number;
  status: "disponible" | "en_comision" | "sin_senal" | "pausado" | "deshabilitado";
  capturedAt: string;
};

export type AiProviderConfig = {
  id: string;
  providerKey: "gemini" | "openai" | "anthropic";
  displayName: string;
  enabled: boolean;
  defaultModel: string;
  encryptedApiKeyRef: string;
  priority: number;
  updatedBy: string;
  updatedAt: string;
};

export type AiPromptTemplate = {
  id: string;
  key: string;
  name: string;
  description: string;
  moduleScope: "general" | "caso" | "evento" | "comision" | "prevalencia" | "reporte";
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  providerKey: "global" | "gemini" | "openai" | "anthropic";
  model?: string;
  temperature: number;
  enabled: boolean;
  version: number;
  updatedBy: string;
  updatedAt: string;
};

export type AiConversation = {
  id: string;
  userId: string;
  relatedCaseId?: string;
  relatedEventId?: string;
  fieldCommissionId?: string;
  promptTemplateId: string;
  title: string;
  status: "activa" | "archivada";
  createdAt: string;
  messages: AiMessage[];
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
};

export type ReportDefinition = {
  id: string;
  title: string;
  type: string;
  filters: string[];
  internal: boolean;
  formats: Array<"CSV" | "XLSX" | "PDF">;
};
