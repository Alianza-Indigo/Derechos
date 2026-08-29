import { desc, eq, inArray } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import * as schema from "@/drizzle/schema";
import { reportCatalog } from "@/lib/reports-catalog";
import type {
  AiConversation,
  AiMessage,
  AiPromptTemplate,
  AiProviderConfig,
  AuditLog,
  DelegateLocationPing,
  EventRecord,
  FieldCommission,
  HumanRightsCase,
  LocationTrackingSetting,
  Member,
  PrevalenceMetric,
  PrevalenceRecord,
  PrevalenceStudy,
  RoleKey,
  Territory,
  User,
} from "@/lib/types";
import { authOptions } from "@/server/auth/options";
import { getDb, type Database } from "@/server/db";
import { canAccessCase, canAccessTerritory } from "@/server/permissions/rbac";

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : undefined);
const num = (value: string | null | undefined) => (value === null || value === undefined ? undefined : Number(value));

// ---------------------------------------------------------------------------
// Cache de referencia por request: territorios y usuarios son tablas pequenas
// y compartidas. Se rellenan al inicio de cada consulta para que los helpers
// sincronos getTerritoryName/getUserName sigan funcionando dentro del JSX.
// ---------------------------------------------------------------------------
let territoryCache: Territory[] = [];
let userCache: User[] = [];

function mapTerritory(row: typeof schema.territories.$inferSelect): Territory {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    countryCode: row.countryCode,
    stateCode: row.stateCode ?? undefined,
    cityName: row.cityName ?? undefined,
    parentId: row.parentId ?? undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

async function loadUsers(db: Database): Promise<User[]> {
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      status: schema.users.status,
      territoryId: schema.users.territoryId,
      passwordHash: schema.users.passwordHash,
      roleKey: schema.roles.key,
    })
    .from(schema.users)
    .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .leftJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId));

  const byId = new Map<string, User>();
  for (const row of rows) {
    let user = byId.get(row.id);
    if (!user) {
      user = {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone ?? undefined,
        status: row.status,
        roles: [],
        territoryId: row.territoryId ?? undefined,
        passwordHash: row.passwordHash ?? undefined,
      };
      byId.set(row.id, user);
    }
    if (row.roleKey) {
      user.roles.push(row.roleKey as RoleKey);
    }
  }
  return Array.from(byId.values());
}

async function loadReference() {
  const db = getDb();
  const [territoryRows, users] = await Promise.all([db.select().from(schema.territories), loadUsers(db)]);
  territoryCache = territoryRows.map(mapTerritory);
  userCache = users;
  return { db, territories: territoryCache, users };
}

export function getTerritoryName(id?: string) {
  return territoryCache.find((territory) => territory.id === id)?.name ?? "Sin territorio";
}

export function getUserName(id?: string) {
  return userCache.find((user) => user.id === id)?.name ?? "Sin asignar";
}

// ---------------------------------------------------------------------------
// Usuario autenticado
// ---------------------------------------------------------------------------
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  const users = await loadUsers(db);
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export async function getCurrentUser(): Promise<User> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const user = email ? await getUserByEmail(email) : undefined;
  if (!user) {
    redirect("/login");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------
async function mapMembers(db: Database, rows: (typeof schema.members.$inferSelect)[]): Promise<Member[]> {
  if (!rows.length) {
    return [];
  }
  const credentials = await db
    .select()
    .from(schema.memberCredentials)
    .where(inArray(schema.memberCredentials.memberId, rows.map((row) => row.id)));
  const credByMember = new Map<string, typeof schema.memberCredentials.$inferSelect>();
  for (const credential of credentials) {
    const existing = credByMember.get(credential.memberId);
    if (!existing || credential.issuedAt > existing.issuedAt) {
      credByMember.set(credential.memberId, credential);
    }
  }

  return rows.map((row) => {
    const credential = credByMember.get(row.id);
    return {
      id: row.id,
      memberNumber: row.memberNumber,
      userId: row.userId ?? undefined,
      fullName: row.fullName,
      birthDate: iso(row.birthDate) ?? "",
      gender: row.gender,
      phone: row.phone,
      email: row.email,
      address: row.address,
      territoryId: row.territoryId,
      status: row.status,
      joinedAt: iso(row.joinedAt) ?? "",
      credentialSlug: credential?.publicSlug ?? "",
      credentialStatus: credential?.status ?? "activa",
      credentialExpiresAt: iso(credential?.expiresAt) ?? "",
    };
  });
}

export async function listMembers(query?: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.members).orderBy(desc(schema.members.joinedAt));
  const members = await mapMembers(db, rows);
  return filterText(members, query, (member) => [member.fullName, member.memberNumber, member.email, member.status]);
}

export async function getMemberById(id: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.members).where(eq(schema.members.id, id));
  return (await mapMembers(db, rows))[0];
}

export async function getMemberByCredentialSlug(slug: string) {
  const db = getDb();
  const credential = (
    await db.select().from(schema.memberCredentials).where(eq(schema.memberCredentials.publicSlug, slug))
  )[0];
  if (!credential) {
    return undefined;
  }
  await loadReference();
  const rows = await db.select().from(schema.members).where(eq(schema.members.id, credential.memberId));
  return (await mapMembers(db, rows))[0];
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------
async function mapCases(db: Database, rows: (typeof schema.cases.$inferSelect)[]): Promise<HumanRightsCase[]> {
  if (!rows.length) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const [people, actions, evidence] = await Promise.all([
    db.select().from(schema.casePeople).where(inArray(schema.casePeople.caseId, ids)),
    db.select().from(schema.caseActions).where(inArray(schema.caseActions.caseId, ids)),
    db.select().from(schema.caseEvidence).where(inArray(schema.caseEvidence.caseId, ids)),
  ]);

  return rows.map((row) => ({
    id: row.id,
    caseNumber: row.caseNumber,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    territoryId: row.territoryId,
    openedBy: row.openedBy,
    assignedTo: row.assignedTo,
    openedAt: iso(row.openedAt) ?? "",
    dueDate: iso(row.dueDate),
    persons: people
      .filter((person) => person.caseId === row.id)
      .map((person) => ({
        id: person.id,
        personType: person.personType as HumanRightsCase["persons"][number]["personType"],
        name: person.name,
        contact: person.contact,
        demographicData: person.demographicData,
        consentStatus: person.consentStatus,
      })),
    actions: actions
      .filter((action) => action.caseId === row.id)
      .map((action) => ({
        id: action.id,
        actionType: action.actionType,
        description: action.description,
        dueDate: iso(action.dueDate),
        completedAt: iso(action.completedAt),
        createdBy: action.createdBy,
      })),
    evidence: evidence
      .filter((item) => item.caseId === row.id)
      .map((item) => ({
        id: item.id,
        fileUrl: item.fileUrl,
        fileType: item.fileType,
        description: item.description,
        uploadedBy: item.uploadedBy,
        createdAt: iso(item.createdAt) ?? "",
      })),
    internalNotes: row.internalNotes ?? [],
  }));
}

export async function listCases(query?: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.cases).orderBy(desc(schema.cases.openedAt));
  const cases = await mapCases(db, rows);
  return filterText(cases, query, (record) => [record.caseNumber, record.title, record.category, record.status, record.priority]);
}

export async function getCaseById(id: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.cases).where(eq(schema.cases.id, id));
  return (await mapCases(db, rows))[0];
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
async function mapEvents(db: Database, rows: (typeof schema.events.$inferSelect)[]): Promise<EventRecord[]> {
  if (!rows.length) {
    return [];
  }
  const evidence = await db
    .select()
    .from(schema.eventEvidence)
    .where(inArray(schema.eventEvidence.eventId, rows.map((row) => row.id)));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.eventType,
    dateStart: iso(row.dateStart) ?? "",
    dateEnd: iso(row.dateEnd) ?? "",
    location: row.location,
    territoryId: row.territoryId,
    organizerId: row.organizerId,
    attendeesCount: row.attendeesCount,
    institutions: row.institutions ?? [],
    impactSummary: row.impactSummary,
    indicators: row.indicators ?? [],
    evidence: evidence
      .filter((item) => item.eventId === row.id)
      .map((item) => ({
        id: item.id,
        fileUrl: item.fileUrl,
        fileType: item.type,
        description: item.description,
        uploadedBy: row.organizerId,
        createdAt: iso(item.createdAt) ?? "",
      })),
  }));
}

export async function listEvents(query?: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.events).orderBy(desc(schema.events.dateStart));
  const events = await mapEvents(db, rows);
  return filterText(events, query, (event) => [event.title, event.eventType, event.location, event.impactSummary]);
}

export async function getEventById(id: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.events).where(eq(schema.events.id, id));
  return (await mapEvents(db, rows))[0];
}

// ---------------------------------------------------------------------------
// Territorios / usuarios
// ---------------------------------------------------------------------------
export async function getTerritories() {
  const { territories } = await loadReference();
  return territories;
}

export async function getUsers() {
  const { users } = await loadReference();
  return users;
}

// ---------------------------------------------------------------------------
// Operacion territorial
// ---------------------------------------------------------------------------
function mapPing(row: typeof schema.delegateLocationPings.$inferSelect): DelegateLocationPing {
  return {
    id: row.id,
    userId: row.userId,
    fieldCommissionId: row.fieldCommissionId ?? undefined,
    territoryId: row.territoryId,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracyMeters,
    captureMode: row.captureMode,
    batteryLevel: row.batteryLevel ?? undefined,
    status: row.status,
    capturedAt: iso(row.capturedAt) ?? "",
  };
}

function mapLocationSetting(row: typeof schema.locationTrackingSettings.$inferSelect): LocationTrackingSetting {
  return {
    id: row.id,
    userId: row.userId,
    enabled: row.enabled,
    mode: row.mode,
    allowedDays: row.allowedDays ?? [],
    allowedHours: row.allowedHours ?? { from: "08:00", to: "18:00" },
    retentionDays: row.retentionDays,
    disabledReason: row.disabledReason ?? undefined,
    updatedBy: row.updatedBy,
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

async function loadCommissions(db: Database, rows: (typeof schema.fieldCommissions.$inferSelect)[]): Promise<FieldCommission[]> {
  if (!rows.length) {
    return [];
  }
  const pings = await db
    .select()
    .from(schema.delegateLocationPings)
    .where(inArray(schema.delegateLocationPings.fieldCommissionId, rows.map((row) => row.id)))
    .orderBy(desc(schema.delegateLocationPings.capturedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    commissionType: row.commissionType,
    description: row.description,
    assignedTo: row.assignedTo,
    territoryId: row.territoryId,
    relatedCaseId: row.relatedCaseId ?? undefined,
    relatedEventId: row.relatedEventId ?? undefined,
    status: row.status,
    scheduledAt: iso(row.scheduledAt) ?? "",
    completedAt: iso(row.completedAt),
    checkIns: pings.filter((ping) => ping.fieldCommissionId === row.id).map(mapPing),
  }));
}

export async function getOperationsData() {
  const { db, users } = await loadReference();
  const [commissionRows, settingRows, pingRows] = await Promise.all([
    db.select().from(schema.fieldCommissions).orderBy(desc(schema.fieldCommissions.scheduledAt)),
    db.select().from(schema.locationTrackingSettings),
    db.select().from(schema.delegateLocationPings).orderBy(desc(schema.delegateLocationPings.capturedAt)),
  ]);
  return {
    fieldCommissions: await loadCommissions(db, commissionRows),
    locationSettings: settingRows.map(mapLocationSetting),
    pings: pingRows.map(mapPing),
    people: users.filter((user) => user.roles.includes("territorial_delegate") || user.roles.includes("field_commissioner")),
  };
}

export async function getCommissionById(id: string) {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.fieldCommissions).where(eq(schema.fieldCommissions.id, id));
  return (await loadCommissions(db, rows))[0];
}

// ---------------------------------------------------------------------------
// Asistente IA
// ---------------------------------------------------------------------------
function mapProvider(row: typeof schema.aiProviderConfigs.$inferSelect): AiProviderConfig {
  return {
    id: row.id,
    providerKey: row.providerKey,
    displayName: row.displayName,
    enabled: row.enabled,
    defaultModel: row.defaultModel,
    encryptedApiKeyRef: row.encryptedApiKeyRef,
    priority: row.priority,
    updatedBy: row.updatedBy,
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

function mapPrompt(row: typeof schema.aiPromptTemplates.$inferSelect): AiPromptTemplate {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    moduleScope: row.moduleScope,
    systemPrompt: row.systemPrompt,
    userPromptTemplate: row.userPromptTemplate,
    variables: row.variables ?? [],
    providerKey: row.providerKey,
    model: row.model ?? undefined,
    temperature: Number(row.temperature),
    enabled: row.enabled,
    version: row.version,
    updatedBy: row.updatedBy,
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

export async function listProviderConfigs(): Promise<AiProviderConfig[]> {
  const db = getDb();
  const rows = await db.select().from(schema.aiProviderConfigs).orderBy(schema.aiProviderConfigs.priority);
  return rows.map(mapProvider);
}

export async function listPrompts(): Promise<AiPromptTemplate[]> {
  const db = getDb();
  const rows = await db.select().from(schema.aiPromptTemplates).orderBy(desc(schema.aiPromptTemplates.updatedAt));
  return rows.map(mapPrompt);
}

export async function getPromptRecordById(id: string): Promise<AiPromptTemplate | undefined> {
  const db = getDb();
  const rows = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, id));
  return rows[0] ? mapPrompt(rows[0]) : undefined;
}

export async function getAssistantData() {
  const { db } = await loadReference();
  const [providerRows, promptRows, conversationRows] = await Promise.all([
    db.select().from(schema.aiProviderConfigs).orderBy(schema.aiProviderConfigs.priority),
    db.select().from(schema.aiPromptTemplates).orderBy(desc(schema.aiPromptTemplates.updatedAt)),
    db.select().from(schema.aiConversations).orderBy(desc(schema.aiConversations.createdAt)),
  ]);

  let conversations: AiConversation[] = [];
  if (conversationRows.length) {
    const messages = await db
      .select()
      .from(schema.aiMessages)
      .where(inArray(schema.aiMessages.conversationId, conversationRows.map((row) => row.id)));
    conversations = conversationRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      relatedCaseId: row.relatedCaseId ?? undefined,
      relatedEventId: row.relatedEventId ?? undefined,
      fieldCommissionId: row.fieldCommissionId ?? undefined,
      promptTemplateId: row.promptTemplateId,
      title: row.title,
      status: row.status as AiConversation["status"],
      createdAt: iso(row.createdAt) ?? "",
      messages: messages
        .filter((message) => message.conversationId === row.id)
        .map(
          (message): AiMessage => ({
            id: message.id,
            conversationId: message.conversationId,
            role: message.role,
            content: message.content,
            metadata: message.metadata,
            createdAt: iso(message.createdAt) ?? "",
          }),
        ),
    }));
  }

  return {
    providerConfigs: providerRows.map(mapProvider),
    prompts: promptRows.map(mapPrompt),
    conversations,
  };
}

export async function getPromptById(id: string) {
  return getPromptRecordById(id);
}

// ---------------------------------------------------------------------------
// Prevalencia
// ---------------------------------------------------------------------------
export async function getPrevalenceData() {
  const { db, territories } = await loadReference();
  const [studyRows, metricRows, recordRows] = await Promise.all([
    db.select().from(schema.prevalenceStudies),
    db.select().from(schema.prevalenceMetrics),
    db.select().from(schema.prevalenceRecords),
  ]);

  const studies: PrevalenceStudy[] = studyRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    methodology: row.methodology,
    startDate: iso(row.startDate) ?? "",
    endDate: iso(row.endDate) ?? "",
    status: row.status as PrevalenceStudy["status"],
  }));

  const metrics: PrevalenceMetric[] = metricRows.map((row) => ({
    id: row.id,
    studyId: row.studyId,
    indicatorKey: row.indicatorKey,
    label: row.label,
    description: row.description,
    valueType: row.valueType as PrevalenceMetric["valueType"],
  }));

  const records: PrevalenceRecord[] = recordRows.map((row) => ({
    id: row.id,
    studyId: row.studyId,
    metricId: row.metricId,
    territoryId: row.territoryId,
    valueNumeric: num(row.valueNumeric),
    valueText: row.valueText ?? undefined,
    sampleSize: row.sampleSize ?? undefined,
    source: row.source,
    measuredAt: iso(row.measuredAt) ?? "",
  }));

  return {
    studies,
    metrics,
    records,
    byTerritory: territories.map((territory) => ({
      territory,
      value: records
        .filter((record) => record.territoryId === territory.id)
        .reduce((sum, record) => sum + Number(record.valueNumeric ?? 0), 0),
    })),
  };
}

// ---------------------------------------------------------------------------
// Reportes / auditoria / configuracion
// ---------------------------------------------------------------------------
export async function getReportDefinitions() {
  return reportCatalog;
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const { db } = await loadReference();
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId ?? "system",
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before ?? undefined,
    after: row.after ?? undefined,
    ip: row.ip ?? undefined,
    createdAt: iso(row.createdAt) ?? "",
  }));
}

export async function getOrganization() {
  const db = getDb();
  const row = (await db.select().from(schema.organizations).limit(1))[0];
  return {
    id: row?.id ?? "org",
    name: row?.name ?? process.env.APP_NAME ?? "Derechos Humanos",
    legalName: row?.legalName ?? "",
    logoUrl: row?.logoUrl ?? "",
    primaryColor: row?.primaryColor ?? "#0f766e",
    country: row?.country ?? "Mexico",
    geolocationEnabled: row?.geolocationEnabled ?? true,
    aiEnabled: row?.aiEnabled ?? true,
    locationRetentionDays: row?.locationRetentionDays ?? 30,
  };
}

export async function getConfiguration() {
  const { db } = await loadReference();
  const [organization, providerRows, settingRows] = await Promise.all([
    getOrganization(),
    db.select().from(schema.aiProviderConfigs).orderBy(schema.aiProviderConfigs.priority),
    db.select().from(schema.locationTrackingSettings),
  ]);
  return {
    organization,
    aiProviderConfigs: providerRows.map(mapProvider),
    locationSettings: settingRows.map(mapLocationSetting),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardData(user: User) {
  const { db } = await loadReference();
  const [caseRows, memberRows, eventRows, pingRows, auditRows, conversationRows, organization] = await Promise.all([
    db.select().from(schema.cases).orderBy(desc(schema.cases.openedAt)),
    db.select().from(schema.members),
    db.select().from(schema.events).orderBy(desc(schema.events.dateStart)),
    db.select().from(schema.delegateLocationPings),
    db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(8),
    db.select({ id: schema.aiConversations.id }).from(schema.aiConversations),
    getOrganization(),
  ]);

  const allCases = await mapCases(db, caseRows);
  const allMembers = await mapMembers(db, memberRows);
  const allEvents = await mapEvents(db, eventRows);
  const pings = pingRows.map(mapPing);

  const accessibleCases = allCases.filter((record) => canAccessCase(user, record));
  const accessibleMembers = allMembers.filter((member) => canAccessTerritory(user, member.territoryId));
  const accessibleEvents = allEvents.filter((event) => canAccessTerritory(user, event.territoryId));
  const urgentCases = accessibleCases.filter((record) => record.priority === "Urgente" && !["Resuelto", "Archivado"].includes(record.status));
  const activeLocations = pings.filter((ping) => ping.status !== "deshabilitado");

  return {
    organization,
    kpis: [
      { label: "Miembros activos", value: accessibleMembers.filter((member) => member.status === "activo").length, tone: "teal" },
      { label: "Nuevos del mes", value: accessibleMembers.filter((member) => member.joinedAt.startsWith("2026-08")).length, tone: "blue" },
      { label: "Casos abiertos", value: accessibleCases.filter((record) => !["Resuelto", "Archivado"].includes(record.status)).length, tone: "amber" },
      { label: "Casos urgentes", value: urgentCases.length, tone: "red" },
      { label: "Casos resueltos", value: accessibleCases.filter((record) => record.status === "Resuelto").length, tone: "green" },
      { label: "Eventos realizados", value: accessibleEvents.length, tone: "violet" },
      { label: "Personas alcanzadas", value: accessibleEvents.reduce((sum, event) => sum + event.attendeesCount, 0), tone: "cyan" },
      { label: "Presencia territorial", value: new Set([...accessibleMembers.map((member) => member.territoryId), ...accessibleEvents.map((event) => event.territoryId)]).size, tone: "slate" },
      { label: "Prevalencia estimada", value: "6.8%", tone: "indigo" },
      { label: "Alertas pendientes", value: urgentCases.length + 3, tone: "orange" },
      { label: "En campo", value: activeLocations.filter((ping) => ping.status === "en_comision").length, tone: "emerald" },
      { label: "Check-ins vencidos", value: 2, tone: "rose" },
      { label: "Uso IA", value: conversationRows.length, tone: "purple" },
    ],
    casesByStatus: aggregate(accessibleCases, "status"),
    casesByCategory: aggregate(accessibleCases, "category"),
    urgentCases,
    overdueActions: accessibleCases.flatMap((record) => record.actions.map((action) => ({ ...action, caseNumber: record.caseNumber, caseTitle: record.title }))).slice(0, 6),
    recentEvents: accessibleEvents.slice(0, 5),
    recentAudit: auditRows.map((row) => ({
      id: row.id,
      actorId: row.actorId ?? "system",
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before ?? undefined,
      after: row.after ?? undefined,
      ip: row.ip ?? undefined,
      createdAt: iso(row.createdAt) ?? "",
    })),
    activeLocations,
  };
}

// ---------------------------------------------------------------------------
// Numeradores
// ---------------------------------------------------------------------------
export async function nextMemberNumber() {
  const db = getDb();
  const rows = await db.select({ id: schema.members.id }).from(schema.members);
  return `ORG-CHH-${String(rows.length + 1).padStart(6, "0")}`;
}

export async function nextCaseNumber() {
  const db = getDb();
  const rows = await db.select({ id: schema.cases.id }).from(schema.cases);
  return `CASO-2026-CHH-${String(rows.length + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function aggregate<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const item of items) {
    const label = String(item[key]);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function filterText<T>(items: T[], query: string | undefined, fields: (item: T) => string[]) {
  if (!query) {
    return items;
  }
  const normalized = query.toLowerCase();
  return items.filter((item) => fields(item).some((field) => field.toLowerCase().includes(normalized)));
}
