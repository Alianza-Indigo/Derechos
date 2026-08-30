import { cache } from "react";
import { organization, reports } from "@/lib/mock-data";
import type { HumanRightsCase, Member, User } from "@/lib/types";
import type { MemberFilters } from "@/lib/validators";
import { eq, desc, inArray } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { authOptions } from "@/server/auth/options";
import { writeAuditLog } from "@/server/audit/log";
import { canAccessCase, canAccessTerritory, canViewSensitive, hasAnyPermission } from "@/server/permissions/rbac";

// La aplicacion lee siempre de Postgres (getDb exige DATABASE_URL). Los nombres
// de referencia (territorios/usuarios) se cargan en una cache por-peticion para
// que getTerritoryName/getUserName sigan siendo sincronos dentro del JSX.
let territoryNameCache = new Map<string, string>();
let userNameCache = new Map<string, string>();

const warmReference = cache(async () => {
  const db = getDb();
  const [territoryRows, userRows] = await Promise.all([
    db.select({ id: schema.territories.id, name: schema.territories.name }).from(schema.territories),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users),
  ]);
  territoryNameCache = new Map(territoryRows.map((row) => [row.id, row.name]));
  userNameCache = new Map(userRows.map((row) => [row.id, row.name]));
});

export async function getCurrentUser(): Promise<User> {
  await warmReference();
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase();
  if (!sessionEmail) {
    redirect("/login");
  }
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, sessionEmail)).limit(1);
  if (!user) {
    redirect("/login");
  }
  const roleRows = await db
    .select({ role: schema.roles.key, scopeId: schema.userRoles.scopeId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, user.id));
  return dbUserToDomain(user, roleRows.map((row) => row.role as User["roles"][number]), roleRows[0]?.scopeId ?? undefined);
}

function redactMember(member: Member, allowSensitive: boolean): Member {
  if (allowSensitive) {
    return member;
  }
  return { ...member, phone: "Reservado", email: "Reservado", address: "Reservado" };
}

function redactCase(record: HumanRightsCase, allowSensitive: boolean): HumanRightsCase {
  if (allowSensitive) {
    return record;
  }
  return { ...record, persons: record.persons.map((person) => ({ ...person, contact: "Reservado" })) };
}

export async function getDashboardData() {
  // Las consultas de lista ya aplican el alcance del usuario autenticado.
  const [accessibleCases, accessibleMembers, accessibleEvents, auditRows, operations] = await Promise.all([
    listCases(),
    listMembers(),
    listEvents(),
    getAuditLogs(),
    getOperationsData(),
  ]);
  const urgentCases = accessibleCases.filter((record) => record.priority === "Urgente" && !["Resuelto", "Archivado"].includes(record.status));
  const activeLocations = operations.pings.filter((ping) => ping.status !== "deshabilitado");
  const overdueCheckins = operations.fieldCommissions.filter((commission) => commission.status === "activa" && commission.checkIns.length === 0).length;
  const prevalence = await getPrevalenceData();
  const prevalenceMetric = prevalence.records.filter((record) => record.metricId && prevalence.metrics.find((metric) => metric.id === record.metricId && metric.valueType === "porcentaje"));
  const prevalenceAvg = prevalenceMetric.length
    ? prevalenceMetric.reduce((sum, record) => sum + Number(record.valueNumeric ?? 0), 0) / prevalenceMetric.length
    : 0;

  return {
    organization: (await getConfiguration()).organization,
    kpis: [
      { label: "Miembros activos", value: accessibleMembers.filter((member) => member.status === "activo").length, tone: "teal" },
      { label: "Nuevos del mes", value: accessibleMembers.filter((member) => member.joinedAt.startsWith("2026-08")).length, tone: "blue" },
      { label: "Casos abiertos", value: accessibleCases.filter((record) => !["Resuelto", "Archivado"].includes(record.status)).length, tone: "amber" },
      { label: "Casos urgentes", value: urgentCases.length, tone: "red" },
      { label: "Casos resueltos", value: accessibleCases.filter((record) => record.status === "Resuelto").length, tone: "green" },
      { label: "Eventos realizados", value: accessibleEvents.length, tone: "violet" },
      { label: "Personas alcanzadas", value: accessibleEvents.reduce((sum, event) => sum + event.attendeesCount, 0), tone: "cyan" },
      { label: "Presencia territorial", value: new Set([...accessibleMembers.map((member) => member.territoryId), ...accessibleEvents.map((event) => event.territoryId)]).size, tone: "slate" },
      { label: "Prevalencia estimada", value: `${prevalenceAvg.toFixed(1)}%`, tone: "indigo" },
      { label: "Alertas pendientes", value: urgentCases.length, tone: "orange" },
      { label: "En campo", value: activeLocations.filter((ping) => ping.status === "en_comision").length, tone: "emerald" },
      { label: "Check-ins pendientes", value: overdueCheckins, tone: "rose" },
      { label: "Uso IA", value: (await getAssistantData()).conversations.length, tone: "purple" },
    ],
    casesByStatus: aggregate(accessibleCases, "status"),
    casesByCategory: aggregate(accessibleCases, "category"),
    urgentCases,
    overdueActions: accessibleCases.flatMap((record) => record.actions.map((action) => ({ ...action, caseNumber: record.caseNumber, caseTitle: record.title }))).slice(0, 6),
    recentEvents: accessibleEvents.slice(0, 5),
    recentAudit: auditRows.slice(0, 8),
    activeLocations,
  };
}

export async function listMembers(filters?: string | MemberFilters) {
  const f: MemberFilters = typeof filters === "string" ? { q: filters } : filters ?? {};
  const db = getDb();
  const user = await getCurrentUser();
  const sensitive = canViewSensitive(user);
  const rows = await db
    .select({ member: schema.members, credential: schema.memberCredentials })
    .from(schema.members)
    .leftJoin(schema.memberCredentials, eq(schema.memberCredentials.memberId, schema.members.id))
    .orderBy(desc(schema.members.joinedAt));
  const domain = rows
    .map(({ member, credential }) => dbMemberToDomain(member, credential))
    .filter((member) => canAccessTerritory(user, member.territoryId))
    .filter((member) => (f.territoryId ? member.territoryId === f.territoryId : true))
    .filter((member) => (f.status ? member.status === f.status : true))
    .filter((member) => (f.from ? member.joinedAt >= f.from : true))
    .filter((member) => (f.to ? member.joinedAt <= `${f.to}T23:59:59.999Z` : true))
    .map((member) => redactMember(member, sensitive));
  return filterText(domain, f.q, (member) => [member.fullName, member.memberNumber, member.email, member.status]);
}

export async function getMemberById(id: string) {
  const db = getDb();
  const user = await getCurrentUser();
  const [row] = await db
    .select({ member: schema.members, credential: schema.memberCredentials })
    .from(schema.members)
    .leftJoin(schema.memberCredentials, eq(schema.memberCredentials.memberId, schema.members.id))
    .where(eq(schema.members.id, id))
    .limit(1);
  if (!row) {
    return undefined;
  }
  const member = dbMemberToDomain(row.member, row.credential);
  if (!canAccessTerritory(user, member.territoryId)) {
    return undefined;
  }
  return redactMember(member, canViewSensitive(user));
}

// Portal de miembro: el miembro ligado al usuario autenticado (sus propios
// datos, sin redaccion). Devuelve undefined si el usuario no es un miembro.
export async function getMemberSelf() {
  const db = getDb();
  const user = await getCurrentUser();
  const [row] = await db
    .select({ member: schema.members, credential: schema.memberCredentials })
    .from(schema.members)
    .leftJoin(schema.memberCredentials, eq(schema.memberCredentials.memberId, schema.members.id))
    .where(eq(schema.members.userId, user.id))
    .limit(1);
  return row ? dbMemberToDomain(row.member, row.credential) : undefined;
}

// Reportes levantados por el propio miembro (casos que el abrio).
export async function getMyReports() {
  const db = getDb();
  const user = await getCurrentUser();
  const rows = await db.select().from(schema.cases).where(eq(schema.cases.openedBy, user.id)).orderBy(desc(schema.cases.openedAt));
  return rows.map((record) => dbCaseToDomain(record));
}

// Publico (pagina de credencial): solo datos minimos, sin sesion.
export async function getMemberByCredentialSlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ member: schema.members, credential: schema.memberCredentials })
    .from(schema.memberCredentials)
    .innerJoin(schema.members, eq(schema.members.id, schema.memberCredentials.memberId))
    .where(eq(schema.memberCredentials.publicSlug, slug))
    .limit(1);
  return row ? dbMemberToDomain(row.member, row.credential) : undefined;
}

export type CaseFilters = {
  q?: string;
  category?: string;
  status?: string;
  priority?: string;
  territoryId?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
};

export async function listCases(filters?: string | CaseFilters) {
  const f: CaseFilters = typeof filters === "string" ? { q: filters } : filters ?? {};
  const db = getDb();
  const user = await getCurrentUser();
  const sensitive = canViewSensitive(user);
  const rows = await db.select().from(schema.cases).orderBy(desc(schema.cases.openedAt));
  const domain = rows
    .map((record) => dbCaseToDomain(record))
    .filter((record) => canAccessCase(user, record))
    .filter((record) => (f.category ? record.category === f.category : true))
    .filter((record) => (f.status ? record.status === f.status : true))
    .filter((record) => (f.priority ? record.priority === f.priority : true))
    .filter((record) => (f.territoryId ? record.territoryId === f.territoryId : true))
    .filter((record) => (f.assignedTo ? record.assignedTo === f.assignedTo : true))
    .filter((record) => (f.from ? record.openedAt >= f.from : true))
    .filter((record) => (f.to ? record.openedAt <= `${f.to}T23:59:59.999Z` : true))
    .map((record) => redactCase(record, sensitive));
  return filterText(domain, f.q, (record) => [record.caseNumber, record.title, record.category, record.status, record.priority]);
}

export async function getCaseById(id: string) {
  const db = getDb();
  const user = await getCurrentUser();
  const [record] = await db.select().from(schema.cases).where(eq(schema.cases.id, id)).limit(1);
  if (!record) {
    return undefined;
  }
  const [people, actions, evidence, notes] = await Promise.all([
    db.select().from(schema.casePeople).where(eq(schema.casePeople.caseId, id)),
    db.select().from(schema.caseActions).where(eq(schema.caseActions.caseId, id)),
    db.select().from(schema.caseEvidence).where(eq(schema.caseEvidence.caseId, id)),
    db.select().from(schema.caseNotes).where(eq(schema.caseNotes.caseId, id)),
  ]);
  const domain = dbCaseToDomain(record, people, actions, evidence, notes.map((note) => note.note));
  if (!canAccessCase(user, domain)) {
    return undefined;
  }
  return redactCase(domain, canViewSensitive(user));
}

export async function listEvents(query?: string) {
  const db = getDb();
  const user = await getCurrentUser();
  const rows = await db.select().from(schema.events).orderBy(desc(schema.events.dateStart));
  const domain = rows.map((event) => dbEventToDomain(event)).filter((event) => canAccessTerritory(user, event.territoryId));
  return filterText(domain, query, (event) => [event.title, event.eventType, event.location, event.impactSummary]);
}

export async function getEventById(id: string) {
  const db = getDb();
  const user = await getCurrentUser();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  if (!event) {
    return undefined;
  }
  const evidence = await db.select().from(schema.eventEvidence).where(eq(schema.eventEvidence.eventId, id));
  const domain = dbEventToDomain(event, evidence);
  if (!canAccessTerritory(user, domain.territoryId)) {
    return undefined;
  }
  return domain;
}

export async function getTerritories() {
  const db = getDb();
  const rows = await db.select().from(schema.territories);
  return rows.map((territory) => ({
    id: territory.id,
    type: territory.type,
    name: territory.name,
    countryCode: territory.countryCode,
    stateCode: territory.stateCode ?? undefined,
    cityName: territory.cityName ?? undefined,
    parentId: territory.parentId ?? undefined,
    latitude: Number(territory.latitude),
    longitude: Number(territory.longitude),
  }));
}

export async function getUsers() {
  const db = getDb();
  const rows = await db.select().from(schema.users);
  return rows.map((user) => dbUserToDomain(user, [], undefined));
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: "active" | "disabled" | "pending";
  roles: Array<{ role: string; scopeType: string; scopeId?: string; scopeName: string }>;
};

// Listado de usuarios con sus roles y alcance, solo para administracion.
export async function getUsersWithRoles(): Promise<AdminUserRow[]> {
  await warmReference();
  const user = await getCurrentUser();
  if (!hasAnyPermission(user, ["*", "write:config"])) {
    return [];
  }
  const db = getDb();
  const [userRows, roleAssignments, roleRows] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.userRoles),
    db.select().from(schema.roles),
  ]);
  const roleKeyById = new Map(roleRows.map((row) => [row.id, row.key]));
  return userRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    status: row.status,
    roles: roleAssignments
      .filter((assignment) => assignment.userId === row.id)
      .map((assignment) => ({
        role: roleKeyById.get(assignment.roleId) ?? "desconocido",
        scopeType: assignment.scopeType,
        scopeId: assignment.scopeId ?? undefined,
        scopeName: assignment.scopeId ? getTerritoryName(assignment.scopeId) : "Global",
      })),
  }));
}

export async function getOperationsData(options?: { audit?: boolean }) {
  const db = getDb();
  const user = await getCurrentUser();
  const canReadLocation = hasAnyPermission(user, ["location:read", "*"]);
  // Registrar la consulta del mapa/historial de ubicaciones (dato sensible).
  // Solo cuando se accede a la vista operativa (no en cada render del dashboard).
  if (options?.audit && canReadLocation) {
    await writeAuditLog({ actorId: user.id, action: "geolocation.map_view", entityType: "delegate_location_ping", entityId: "map" });
  }
  const [commissionRows, settingRows, pingRows, userRows] = await Promise.all([
    db.select().from(schema.fieldCommissions).orderBy(desc(schema.fieldCommissions.scheduledAt)),
    db.select().from(schema.locationTrackingSettings),
    db.select().from(schema.delegateLocationPings).orderBy(desc(schema.delegateLocationPings.capturedAt)),
    db.select().from(schema.users),
  ]);
  const pings = pingRows
    .map(dbPingToDomain)
    .filter((ping) => canReadLocation || canAccessTerritory(user, ping.territoryId) || ping.userId === user.id);
  const fieldCommissions = commissionRows
    .filter((commission) => canAccessTerritory(user, commission.territoryId) || commission.assignedTo === user.id)
    .map((commission) => ({
      id: commission.id,
      title: commission.title,
      commissionType: commission.commissionType,
      description: commission.description,
      assignedTo: commission.assignedTo,
      territoryId: commission.territoryId,
      relatedCaseId: commission.relatedCaseId ?? undefined,
      relatedEventId: commission.relatedEventId ?? undefined,
      status: commission.status,
      scheduledAt: commission.scheduledAt.toISOString(),
      completedAt: commission.completedAt?.toISOString(),
      checkIns: pings.filter((ping) => ping.fieldCommissionId === commission.id),
    }));
  const locationSettings = settingRows
    .filter((setting) => canReadLocation || setting.userId === user.id)
    .map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      enabled: setting.enabled,
      mode: setting.mode,
      allowedDays: setting.allowedDays,
      allowedHours: setting.allowedHours,
      retentionDays: setting.retentionDays,
      disabledReason: setting.disabledReason ?? undefined,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt.toISOString(),
    }));
  return {
    fieldCommissions,
    locationSettings,
    pings,
    people: userRows.map((item) => dbUserToDomain(item, [], undefined)),
  };
}

export async function getCommissionById(id: string) {
  const db = getDb();
  const user = await getCurrentUser();
  const [commission] = await db.select().from(schema.fieldCommissions).where(eq(schema.fieldCommissions.id, id)).limit(1);
  if (!commission) {
    return undefined;
  }
  if (!(canAccessTerritory(user, commission.territoryId) || commission.assignedTo === user.id)) {
    return undefined;
  }
  const pings = await db.select().from(schema.delegateLocationPings).where(eq(schema.delegateLocationPings.fieldCommissionId, id));
  return {
    id: commission.id,
    title: commission.title,
    commissionType: commission.commissionType,
    description: commission.description,
    assignedTo: commission.assignedTo,
    territoryId: commission.territoryId,
    relatedCaseId: commission.relatedCaseId ?? undefined,
    relatedEventId: commission.relatedEventId ?? undefined,
    status: commission.status,
    scheduledAt: commission.scheduledAt.toISOString(),
    completedAt: commission.completedAt?.toISOString(),
    checkIns: pings.map(dbPingToDomain),
  };
}

export async function getAssistantData() {
  await warmReference();
  const db = getDb();
  const user = await getCurrentUser();
  const canOversee = hasAnyPermission(user, ["*", "read:national", "ai:admin"]);
  const [providerRows, promptRows, allConversationRows, messageRows] = await Promise.all([
    db.select().from(schema.aiProviderConfigs),
    db.select().from(schema.aiPromptTemplates).orderBy(desc(schema.aiPromptTemplates.updatedAt)),
    db.select().from(schema.aiConversations).orderBy(desc(schema.aiConversations.createdAt)),
    db.select().from(schema.aiMessages).orderBy(desc(schema.aiMessages.createdAt)),
  ]);
  // El historial IA se limita al propio usuario salvo roles de supervision.
  const scopedByUser = canOversee ? allConversationRows : allConversationRows.filter((conversation) => conversation.userId === user.id);
  // Ademas, las conversaciones ligadas a un caso heredan el permiso del caso:
  // no se muestran si el usuario no puede acceder al caso relacionado.
  const linkedCaseIds = Array.from(new Set(scopedByUser.map((conversation) => conversation.relatedCaseId).filter((value): value is string => Boolean(value))));
  const accessibleCaseIds = new Set<string>();
  if (linkedCaseIds.length) {
    const caseRows = await db.select().from(schema.cases).where(inArray(schema.cases.id, linkedCaseIds));
    for (const record of caseRows) {
      if (canAccessCase(user, dbCaseToDomain(record))) {
        accessibleCaseIds.add(record.id);
      }
    }
  }
  const conversationRows = scopedByUser.filter((conversation) => !conversation.relatedCaseId || accessibleCaseIds.has(conversation.relatedCaseId));
  return {
    providerConfigs: providerRows.map(dbProviderToDomain),
    prompts: promptRows.map(dbPromptToDomain),
    conversations: conversationRows.map((conversation) => ({
      id: conversation.id,
      userId: conversation.userId,
      relatedCaseId: conversation.relatedCaseId ?? undefined,
      relatedEventId: conversation.relatedEventId ?? undefined,
      fieldCommissionId: conversation.fieldCommissionId ?? undefined,
      promptTemplateId: conversation.promptTemplateId,
      title: conversation.title,
      status: conversation.status as "activa" | "archivada",
      createdAt: conversation.createdAt.toISOString(),
      messages: messageRows.filter((message) => message.conversationId === conversation.id).map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        metadata: message.metadata,
        createdAt: message.createdAt.toISOString(),
      })),
    })),
  };
}

export async function getPromptById(id: string) {
  await warmReference();
  const db = getDb();
  const [prompt] = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, id)).limit(1);
  return prompt ? dbPromptToDomain(prompt) : undefined;
}

export async function getPrevalenceData() {
  const db = getDb();
  const [studyRows, metricRows, recordRows, territoryRows] = await Promise.all([
    db.select().from(schema.prevalenceStudies),
    db.select().from(schema.prevalenceMetrics),
    db.select().from(schema.prevalenceRecords),
    db.select().from(schema.territories),
  ]);
  const domainTerritories = territoryRows.map((territory) => ({
    id: territory.id,
    type: territory.type,
    name: territory.name,
    countryCode: territory.countryCode,
    stateCode: territory.stateCode ?? undefined,
    cityName: territory.cityName ?? undefined,
    parentId: territory.parentId ?? undefined,
    latitude: Number(territory.latitude),
    longitude: Number(territory.longitude),
  }));
  const records = recordRows.map((record) => ({
    id: record.id,
    studyId: record.studyId,
    metricId: record.metricId,
    territoryId: record.territoryId,
    valueNumeric: record.valueNumeric === null ? undefined : Number(record.valueNumeric),
    valueText: record.valueText ?? undefined,
    sampleSize: record.sampleSize ?? undefined,
    source: record.source,
    measuredAt: record.measuredAt.toISOString(),
  }));
  return {
    studies: studyRows.map((study) => ({
      id: study.id,
      name: study.name,
      description: study.description,
      methodology: study.methodology,
      startDate: study.startDate.toISOString(),
      endDate: study.endDate.toISOString(),
      status: study.status as "borrador" | "activo" | "cerrado",
    })),
    metrics: metricRows.map((metric) => ({
      id: metric.id,
      studyId: metric.studyId,
      indicatorKey: metric.indicatorKey,
      label: metric.label,
      description: metric.description,
      valueType: metric.valueType as "numerico" | "tasa" | "conteo" | "porcentaje" | "texto",
    })),
    records,
    byTerritory: domainTerritories.map((territory) => ({
      territory,
      value: records.filter((record) => record.territoryId === territory.id).reduce((sum, record) => sum + Number(record.valueNumeric ?? 0), 0),
    })),
  };
}

export async function getReportDefinitions() {
  return reports;
}

export async function getAuditLogs() {
  const user = await getCurrentUser();
  if (!hasAnyPermission(user, ["read:audit", "audit", "*"])) {
    return [];
  }
  const db = getDb();
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
  return rows.map((log) => ({
    id: log.id,
    actorId: log.actorId ?? "system",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before ?? undefined,
    after: log.after ?? undefined,
    ip: log.ip ?? undefined,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function getConfiguration() {
  await warmReference();
  const db = getDb();
  const [orgRows, providerRows, settingRows, territoryRows, territorySettingRows] = await Promise.all([
    db.select().from(schema.organizations).limit(1),
    db.select().from(schema.aiProviderConfigs).orderBy(schema.aiProviderConfigs.priority),
    db.select().from(schema.locationTrackingSettings),
    db.select().from(schema.territories),
    db.select().from(schema.territoryLocationSettings),
  ]);
  const territorySettings = territoryRows.map((territory) => {
    const setting = territorySettingRows.find((row) => row.territoryId === territory.id);
    return {
      territoryId: territory.id,
      name: territory.name,
      type: territory.type,
      enabled: setting?.enabled ?? false,
      mode: setting?.mode ?? "manual_check_in",
      retentionDays: setting?.retentionDays ?? 30,
    };
  });
  return {
    organization: orgRows[0]
      ? {
        id: orgRows[0].id,
        name: orgRows[0].name,
        legalName: orgRows[0].legalName,
        logoUrl: orgRows[0].logoUrl,
        primaryColor: orgRows[0].primaryColor,
        country: orgRows[0].country,
        geolocationEnabled: orgRows[0].geolocationEnabled,
        aiEnabled: orgRows[0].aiEnabled,
      }
      : organization,
    aiProviderConfigs: providerRows.map(dbProviderToDomain),
    locationSettings: settingRows.map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      enabled: setting.enabled,
      mode: setting.mode,
      allowedDays: setting.allowedDays,
      allowedHours: setting.allowedHours,
      retentionDays: setting.retentionDays,
      disabledReason: setting.disabledReason ?? undefined,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt.toISOString(),
    })),
    territorySettings,
  };
}

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

export function getTerritoryName(id?: string) {
  return (id && territoryNameCache.get(id)) || "Sin territorio";
}

function dbUserToDomain(user: typeof schema.users.$inferSelect, roles: User["roles"], territoryId?: string): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    status: user.status,
    roles,
    territoryId,
  };
}

function dbMemberToDomain(member: typeof schema.members.$inferSelect, credential: typeof schema.memberCredentials.$inferSelect | null): Member {
  return {
    id: member.id,
    memberNumber: member.memberNumber,
    userId: member.userId ?? undefined,
    fullName: member.fullName,
    birthDate: member.birthDate?.toISOString() ?? "",
    gender: member.gender,
    phone: member.phone,
    email: member.email,
    address: member.address,
    photoUrl: member.photoUrl ?? undefined,
    position: member.position ?? undefined,
    territoryId: member.territoryId,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    credentialSlug: credential?.publicSlug ?? "",
    credentialStatus: credential?.status ?? "vencida",
    credentialExpiresAt: credential?.expiresAt?.toISOString() ?? "",
  };
}

function dbCaseToDomain(
  record: typeof schema.cases.$inferSelect,
  people: Array<typeof schema.casePeople.$inferSelect> = [],
  actions: Array<typeof schema.caseActions.$inferSelect> = [],
  evidence: Array<typeof schema.caseEvidence.$inferSelect> = [],
  notes: string[] = [],
): HumanRightsCase {
  return {
    id: record.id,
    caseNumber: record.caseNumber,
    title: record.title,
    description: record.description,
    category: record.category,
    priority: record.priority,
    status: record.status,
    territoryId: record.territoryId,
    openedBy: record.openedBy,
    assignedTo: record.assignedTo,
    openedAt: record.openedAt.toISOString(),
    closedAt: record.closedAt?.toISOString(),
    dueDate: record.dueDate?.toISOString(),
    incidentDate: record.incidentDate?.toISOString(),
    incidentLocation: record.incidentLocation ?? undefined,
    rightViolated: record.rightViolated ?? undefined,
    persons: people.map((person) => ({
      id: person.id,
      personType: person.personType as "victima" | "solicitante" | "autoridad" | "testigo" | "otro",
      name: person.name,
      contact: person.contact,
      demographicData: person.demographicData,
      consentStatus: person.consentStatus,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      description: action.description,
      dueDate: action.dueDate?.toISOString(),
      completedAt: action.completedAt?.toISOString(),
      createdBy: action.createdBy,
    })),
    evidence: evidence.map((item) => ({
      id: item.id,
      fileUrl: item.fileUrl,
      fileType: item.fileType,
      description: item.description,
      uploadedBy: item.uploadedBy,
      createdAt: item.createdAt.toISOString(),
    })),
    internalNotes: notes,
  };
}

function dbEventToDomain(event: typeof schema.events.$inferSelect, evidence: Array<typeof schema.eventEvidence.$inferSelect> = []) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    dateStart: event.dateStart.toISOString(),
    dateEnd: event.dateEnd.toISOString(),
    location: event.location,
    objective: event.objective ?? undefined,
    territoryId: event.territoryId,
    organizerId: event.organizerId,
    attendeesCount: event.attendeesCount,
    institutions: event.institutions,
    impactSummary: event.impactSummary,
    indicators: event.indicators,
    evidence: evidence.map((item) => ({
      id: item.id,
      fileUrl: item.fileUrl,
      fileType: item.type,
      description: item.description,
      uploadedBy: event.organizerId,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function dbPingToDomain(ping: typeof schema.delegateLocationPings.$inferSelect) {
  return {
    id: ping.id,
    userId: ping.userId,
    fieldCommissionId: ping.fieldCommissionId ?? undefined,
    territoryId: ping.territoryId,
    latitude: Number(ping.latitude),
    longitude: Number(ping.longitude),
    accuracyMeters: ping.accuracyMeters,
    captureMode: ping.captureMode,
    batteryLevel: ping.batteryLevel ?? undefined,
    status: ping.status,
    capturedAt: ping.capturedAt.toISOString(),
  };
}

function dbProviderToDomain(provider: typeof schema.aiProviderConfigs.$inferSelect) {
  return {
    id: provider.id,
    providerKey: provider.providerKey,
    displayName: provider.displayName,
    enabled: provider.enabled,
    defaultModel: provider.defaultModel,
    encryptedApiKeyRef: provider.encryptedApiKeyRef,
    priority: provider.priority,
    updatedBy: provider.updatedBy,
    updatedAt: provider.updatedAt.toISOString(),
  };
}

function dbPromptToDomain(prompt: typeof schema.aiPromptTemplates.$inferSelect) {
  return {
    id: prompt.id,
    key: prompt.key,
    name: prompt.name,
    description: prompt.description,
    moduleScope: prompt.moduleScope,
    systemPrompt: prompt.systemPrompt,
    userPromptTemplate: prompt.userPromptTemplate,
    variables: prompt.variables,
    providerKey: prompt.providerKey,
    model: prompt.model ?? undefined,
    temperature: Number(prompt.temperature),
    enabled: prompt.enabled,
    version: prompt.version,
    updatedBy: prompt.updatedBy,
    updatedAt: prompt.updatedAt.toISOString(),
  };
}

export function getUserName(id?: string) {
  return (id && userNameCache.get(id)) || "Sin asignar";
}
