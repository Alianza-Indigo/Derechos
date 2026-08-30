import {
  boolean,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = (name = "id") => uuid(name).defaultRandom().primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const territoryTypeEnum = pgEnum("territory_type", ["country", "state", "city"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled", "pending"]);
export const memberStatusEnum = pgEnum("member_status", ["pendiente", "activo", "suspendido", "baja", "fallecido"]);
export const credentialStatusEnum = pgEnum("credential_status", ["activa", "suspendida", "vencida", "revocada"]);
export const casePriorityEnum = pgEnum("case_priority", ["Baja", "Media", "Alta", "Urgente"]);
export const caseStatusEnum = pgEnum("case_status", [
  "Nuevo",
  "En revision",
  "Aceptado",
  "En seguimiento",
  "En espera de tercero",
  "Resuelto",
  "Cerrado sin accion",
  "Archivado",
]);
export const consentStatusEnum = pgEnum("consent_status", ["documentado", "pendiente", "no_aplica"]);
export const commissionStatusEnum = pgEnum("commission_status", ["programada", "activa", "pausada", "completada", "cancelada"]);
export const locationModeEnum = pgEnum("location_mode", ["disabled", "manual_check_in", "during_commission", "active_shift"]);
export const locationCaptureModeEnum = pgEnum("location_capture_mode", ["manual", "commission", "shift"]);
export const locationStatusEnum = pgEnum("location_status", ["disponible", "en_comision", "sin_senal", "pausado", "deshabilitado"]);
export const aiProviderEnum = pgEnum("ai_provider_key", ["gemini", "openai", "anthropic"]);
export const aiPromptProviderEnum = pgEnum("ai_prompt_provider_key", ["global", "gemini", "openai", "anthropic"]);
export const aiScopeEnum = pgEnum("ai_scope", ["general", "caso", "evento", "comision", "prevalencia", "reporte"]);
export const aiRoleEnum = pgEnum("ai_message_role", ["system", "user", "assistant"]);

// La organizacion es el tenant. Cada organizacion tiene su propio espacio de
// datos aislado (multitenant SaaS).
export const organizations = pgTable("organizations", {
  id: id(),
  slug: text("slug").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0f766e").notNull(),
  country: text("country").default("Mexico").notNull(),
  geolocationEnabled: boolean("geolocation_enabled").default(true).notNull(),
  aiEnabled: boolean("ai_enabled").default(true).notNull(),
  status: text("status").default("active").notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
  codeIdx: uniqueIndex("organizations_code_idx").on(table.code),
}));

// Referencia a la organizacion (tenant) presente en toda tabla de datos.
const orgId = () => uuid("organization_id").references(() => organizations.id).notNull();

export const users = pgTable("users", {
  id: id(),
  organizationId: orgId(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  providerId: text("provider_id"),
  status: userStatusEnum("status").default("active").notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.organizationId, table.email),
  orgIdx: index("users_org_idx").on(table.organizationId),
}));

// Catalogo global de roles (plantillas compartidas por todos los tenants).
export const roles = pgTable("roles", {
  id: id(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
}, (table) => ({
  keyIdx: uniqueIndex("roles_key_idx").on(table.key),
}));

export const territories = pgTable("territories", {
  id: id(),
  organizationId: orgId(),
  type: territoryTypeEnum("type").notNull(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  stateCode: text("state_code"),
  cityName: text("city_name"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 6 }).notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => territories.id),
}, (table) => ({
  orgIdx: index("territories_org_idx").on(table.organizationId),
}));

export const userRoles = pgTable("user_roles", {
  organizationId: orgId(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  roleId: uuid("role_id").references(() => roles.id).notNull(),
  scopeType: text("scope_type").default("global").notNull(),
  scopeId: uuid("scope_id"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId, table.scopeType] }),
  orgIdx: index("user_roles_org_idx").on(table.organizationId),
}));

export const members = pgTable("members", {
  id: id(),
  organizationId: orgId(),
  memberNumber: text("member_number").notNull(),
  userId: uuid("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  birthDate: timestamp("birth_date", { withTimezone: true }),
  gender: text("gender").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  photoUrl: text("photo_url"),
  position: text("position"),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  status: memberStatusEnum("status").default("pendiente").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  memberNumberIdx: uniqueIndex("members_member_number_idx").on(table.organizationId, table.memberNumber),
  orgIdx: index("members_org_idx").on(table.organizationId),
}));

export const memberCredentials = pgTable("member_credentials", {
  id: id(),
  organizationId: orgId(),
  memberId: uuid("member_id").references(() => members.id).notNull(),
  qrToken: text("qr_token").notNull(),
  publicSlug: text("public_slug").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: credentialStatusEnum("status").default("activa").notNull(),
}, (table) => ({
  // El slug y el token del QR son URLs publicas: unicos a nivel global.
  qrTokenIdx: uniqueIndex("member_credentials_qr_token_idx").on(table.qrToken),
  slugIdx: uniqueIndex("member_credentials_public_slug_idx").on(table.publicSlug),
  orgIdx: index("member_credentials_org_idx").on(table.organizationId),
}));

export const cases = pgTable("cases", {
  id: id(),
  organizationId: orgId(),
  caseNumber: text("case_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: casePriorityEnum("priority").default("Media").notNull(),
  status: caseStatusEnum("status").default("Nuevo").notNull(),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  openedBy: uuid("opened_by").references(() => users.id).notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  incidentDate: timestamp("incident_date", { withTimezone: true }),
  incidentLocation: text("incident_location"),
  rightViolated: text("right_violated"),
  createdAt,
  updatedAt,
}, (table) => ({
  caseNumberIdx: uniqueIndex("cases_case_number_idx").on(table.organizationId, table.caseNumber),
  orgIdx: index("cases_org_idx").on(table.organizationId),
}));

export const casePeople = pgTable("case_people", {
  id: id(),
  organizationId: orgId(),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  personType: text("person_type").notNull(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  demographicData: jsonb("demographic_data_json").$type<Record<string, string>>().default({}).notNull(),
  consentStatus: consentStatusEnum("consent_status").default("pendiente").notNull(),
});

export const caseActions = pgTable("case_actions", {
  id: id(),
  organizationId: orgId(),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt,
});

export const caseNotes = pgTable("case_notes", {
  id: id(),
  organizationId: orgId(),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  note: text("note").notNull(),
  visibility: text("visibility").default("internal").notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt,
});

export const caseStatusHistory = pgTable("case_status_history", {
  id: id(),
  organizationId: orgId(),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  fromStatus: caseStatusEnum("from_status"),
  toStatus: caseStatusEnum("to_status").notNull(),
  reason: text("reason").notNull(),
  changedBy: uuid("changed_by").references(() => users.id).notNull(),
  createdAt,
});

export const caseEvidence = pgTable("case_evidence", {
  id: id(),
  organizationId: orgId(),
  caseId: uuid("case_id").references(() => cases.id).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  description: text("description").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt,
});

export const events = pgTable("events", {
  id: id(),
  organizationId: orgId(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  eventType: text("event_type").notNull(),
  dateStart: timestamp("date_start", { withTimezone: true }).notNull(),
  dateEnd: timestamp("date_end", { withTimezone: true }).notNull(),
  location: text("location").notNull(),
  objective: text("objective"),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  organizerId: uuid("organizer_id").references(() => users.id).notNull(),
  attendeesCount: integer("attendees_count").default(0).notNull(),
  institutions: jsonb("institutions").$type<string[]>().default([]).notNull(),
  impactSummary: text("impact_summary").notNull(),
  indicators: jsonb("indicators").$type<string[]>().default([]).notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  orgIdx: index("events_org_idx").on(table.organizationId),
}));

export const eventEvidence = pgTable("event_evidence", {
  id: id(),
  organizationId: orgId(),
  eventId: uuid("event_id").references(() => events.id).notNull(),
  fileUrl: text("file_url").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt,
});

export const credentialVerificationLogs = pgTable("credential_verification_logs", {
  id: id(),
  organizationId: orgId(),
  credentialId: uuid("credential_id").references(() => memberCredentials.id).notNull(),
  publicSlug: text("public_slug").notNull(),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  createdAt,
});

export const prevalenceStudies = pgTable("prevalence_studies", {
  id: id(),
  organizationId: orgId(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  methodology: text("methodology").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  status: text("status").default("activo").notNull(),
  createdAt,
  updatedAt,
}, (table) => ({
  orgIdx: index("prevalence_studies_org_idx").on(table.organizationId),
}));

export const prevalenceMetrics = pgTable("prevalence_metrics", {
  id: id(),
  organizationId: orgId(),
  studyId: uuid("study_id").references(() => prevalenceStudies.id).notNull(),
  indicatorKey: text("indicator_key").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  valueType: text("value_type").notNull(),
});

export const prevalenceRecords = pgTable("prevalence_records", {
  id: id(),
  organizationId: orgId(),
  studyId: uuid("study_id").references(() => prevalenceStudies.id).notNull(),
  metricId: uuid("metric_id").references(() => prevalenceMetrics.id).notNull(),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  valueNumeric: numeric("value_numeric", { precision: 12, scale: 2 }),
  valueText: text("value_text"),
  sampleSize: integer("sample_size"),
  source: text("source").notNull(),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
  createdAt,
}, (table) => ({
  orgIdx: index("prevalence_records_org_idx").on(table.organizationId),
}));

export const reports = pgTable("reports", {
  id: id(),
  organizationId: orgId(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  filters: jsonb("filters_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt,
});

export const fieldCommissions = pgTable("field_commissions", {
  id: id(),
  organizationId: orgId(),
  title: text("title").notNull(),
  commissionType: text("commission_type").notNull(),
  description: text("description").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id).notNull(),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  relatedCaseId: uuid("related_case_id").references(() => cases.id),
  relatedEventId: uuid("related_event_id").references(() => events.id),
  status: commissionStatusEnum("status").default("programada").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => ({
  orgIdx: index("field_commissions_org_idx").on(table.organizationId),
}));

export const locationTrackingSettings = pgTable("location_tracking_settings", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  mode: locationModeEnum("mode").default("manual_check_in").notNull(),
  allowedDays: jsonb("allowed_days_json").$type<string[]>().default([]).notNull(),
  allowedHours: jsonb("allowed_hours_json").$type<{ from: string; to: string }>().default({ from: "08:00", to: "18:00" }).notNull(),
  retentionDays: integer("retention_days").default(30).notNull(),
  disabledReason: text("disabled_reason"),
  updatedBy: uuid("updated_by").references(() => users.id).notNull(),
  updatedAt,
}, (table) => ({
  orgIdx: index("location_tracking_settings_org_idx").on(table.organizationId),
}));

export const territoryLocationSettings = pgTable("territory_location_settings", {
  id: id(),
  organizationId: orgId(),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  mode: locationModeEnum("mode").default("manual_check_in").notNull(),
  retentionDays: integer("retention_days").default(30).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id).notNull(),
  updatedAt,
}, (table) => ({
  territoryIdx: uniqueIndex("territory_location_settings_territory_idx").on(table.organizationId, table.territoryId),
}));

export const delegateLocationPings = pgTable("delegate_location_pings", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  fieldCommissionId: uuid("field_commission_id").references(() => fieldCommissions.id),
  territoryId: uuid("territory_id").references(() => territories.id).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 6 }).notNull(),
  accuracyMeters: integer("accuracy_meters").default(50).notNull(),
  captureMode: locationCaptureModeEnum("capture_mode").default("manual").notNull(),
  batteryLevel: integer("battery_level"),
  status: locationStatusEnum("status").default("disponible").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("delegate_location_pings_org_idx").on(table.organizationId),
}));

export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: id(),
  organizationId: orgId(),
  providerKey: aiProviderEnum("provider_key").notNull(),
  displayName: text("display_name").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  defaultModel: text("default_model").notNull(),
  encryptedApiKeyRef: text("encrypted_api_key_ref").notNull(),
  apiKey: text("api_key"),
  priority: integer("priority").default(10).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id).notNull(),
  updatedAt,
}, (table) => ({
  providerIdx: uniqueIndex("ai_provider_configs_provider_idx").on(table.organizationId, table.providerKey),
}));

export const aiPromptTemplates = pgTable("ai_prompt_templates", {
  id: id(),
  organizationId: orgId(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  moduleScope: aiScopeEnum("module_scope").default("general").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(),
  variables: jsonb("variables_json").$type<string[]>().default([]).notNull(),
  providerKey: aiPromptProviderEnum("provider_key").default("global").notNull(),
  model: text("model"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.30").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id).notNull(),
  updatedAt,
}, (table) => ({
  keyVersionIdx: uniqueIndex("ai_prompt_templates_key_version_idx").on(table.organizationId, table.key, table.version),
}));

export const aiConversations = pgTable("ai_conversations", {
  id: id(),
  organizationId: orgId(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  relatedCaseId: uuid("related_case_id").references(() => cases.id),
  relatedEventId: uuid("related_event_id").references(() => events.id),
  fieldCommissionId: uuid("field_commission_id").references(() => fieldCommissions.id),
  promptTemplateId: uuid("prompt_template_id").references(() => aiPromptTemplates.id).notNull(),
  title: text("title").notNull(),
  status: text("status").default("activa").notNull(),
  createdAt,
}, (table) => ({
  orgIdx: index("ai_conversations_org_idx").on(table.organizationId),
}));

export const aiMessages = pgTable("ai_messages", {
  id: id(),
  organizationId: orgId(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id).notNull(),
  role: aiRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt,
});

export const aiRuns = pgTable("ai_runs", {
  id: id(),
  organizationId: orgId(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id).notNull(),
  promptTemplateId: uuid("prompt_template_id").references(() => aiPromptTemplates.id).notNull(),
  input: jsonb("input_json").$type<Record<string, unknown>>().default({}).notNull(),
  outputText: text("output_text"),
  model: text("model").notNull(),
  tokenUsage: jsonb("token_usage_json").$type<Record<string, unknown>>().default({}).notNull(),
  status: text("status").default("completed").notNull(),
  errorMessage: text("error_message"),
  createdAt,
});

export const aiFeedback = pgTable("ai_feedback", {
  id: id(),
  organizationId: orgId(),
  aiRunId: uuid("ai_run_id").references(() => aiRuns.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt,
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  // Nullable: los eventos de sistema (cron de retencion) no tienen tenant.
  organizationId: uuid("organization_id").references(() => organizations.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before_json").$type<Record<string, unknown>>(),
  after: jsonb("after_json").$type<Record<string, unknown>>(),
  ip: text("ip"),
  createdAt,
}, (table) => ({
  orgIdx: index("audit_logs_org_idx").on(table.organizationId),
}));
