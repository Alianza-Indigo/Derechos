import {
  aiConversations,
  aiPromptTemplates,
  aiProviderConfigs,
  allLocationPings,
  auditLogs,
  cases,
  events,
  fieldCommissions,
  locationSettings,
  members,
  organization,
  prevalenceMetrics,
  prevalenceRecords,
  prevalenceStudies,
  reports,
  territories,
  users,
} from "@/lib/mock-data";
import type { HumanRightsCase, Member, User } from "@/lib/types";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { authOptions } from "@/server/auth/options";
import { canAccessCase, canAccessTerritory } from "@/server/permissions/rbac";
import { stableUuid } from "@/lib/stable-id";

export async function getCurrentUser(): Promise<User> {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase();
  const db = getDb();
  if (db) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, sessionEmail || "admin@demo.org")).limit(1);
    if (user) {
      const roleRows = await db
        .select({ role: schema.roles.key, scopeId: schema.userRoles.scopeId })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
        .where(eq(schema.userRoles.userId, user.id));
      return dbUserToDomain(user, roleRows.map((row) => row.role as User["roles"][number]), roleRows[0]?.scopeId ?? undefined);
    }
  }
  return users.find((user) => user.email.toLowerCase() === sessionEmail) ?? users[0];
}

export async function getDashboardData(user?: User) {
  const currentUser = user ?? await getCurrentUser();
  const [caseRows, memberRows, eventRows, auditRows, operations] = await Promise.all([
    listCases(),
    listMembers(),
    listEvents(),
    getAuditLogs(),
    getOperationsData(),
  ]);
  const accessibleCases = caseRows.filter((record) => canAccessCase(currentUser, record));
  const accessibleMembers = memberRows.filter((member) => canAccessTerritory(currentUser, member.territoryId));
  const accessibleEvents = eventRows.filter((event) => canAccessTerritory(currentUser, event.territoryId));
  const urgentCases = accessibleCases.filter((record) => record.priority === "Urgente" && !["Resuelto", "Archivado"].includes(record.status));
  const activeLocations = operations.pings.filter((ping) => ping.status !== "deshabilitado");

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
      { label: "Uso IA", value: aiConversations.length, tone: "purple" },
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

export async function listMembers(query?: string) {
  const db = getDb();
  if (db) {
    const rows = await db
      .select({ member: schema.members, credential: schema.memberCredentials })
      .from(schema.members)
      .leftJoin(schema.memberCredentials, eq(schema.memberCredentials.memberId, schema.members.id))
      .orderBy(desc(schema.members.joinedAt));
    return filterText(rows.map(({ member, credential }) => dbMemberToDomain(member, credential)), query, (member) => [member.fullName, member.memberNumber, member.email, member.status]);
  }
  return filterText(members, query, (member) => [member.fullName, member.memberNumber, member.email, member.status]);
}

export async function getMemberById(id: string) {
  const db = getDb();
  if (db) {
    const [row] = await db
      .select({ member: schema.members, credential: schema.memberCredentials })
      .from(schema.members)
      .leftJoin(schema.memberCredentials, eq(schema.memberCredentials.memberId, schema.members.id))
      .where(eq(schema.members.id, id))
      .limit(1);
    return row ? dbMemberToDomain(row.member, row.credential) : undefined;
  }
  return members.find((member) => member.id === id);
}

export async function getMemberByCredentialSlug(slug: string) {
  const db = getDb();
  if (db) {
    const [row] = await db
      .select({ member: schema.members, credential: schema.memberCredentials })
      .from(schema.memberCredentials)
      .innerJoin(schema.members, eq(schema.members.id, schema.memberCredentials.memberId))
      .where(eq(schema.memberCredentials.publicSlug, slug))
      .limit(1);
    return row ? dbMemberToDomain(row.member, row.credential) : undefined;
  }
  return members.find((member) => member.credentialSlug === slug);
}

export async function listCases(query?: string) {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.cases).orderBy(desc(schema.cases.openedAt));
    return filterText(rows.map((record) => dbCaseToDomain(record)), query, (record) => [record.caseNumber, record.title, record.category, record.status, record.priority]);
  }
  return filterText(cases, query, (record) => [record.caseNumber, record.title, record.category, record.status, record.priority]);
}

export async function getCaseById(id: string) {
  const db = getDb();
  if (db) {
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
    return dbCaseToDomain(record, people, actions, evidence, notes.map((note) => note.note));
  }
  return cases.find((record) => record.id === id);
}

export async function listEvents(query?: string) {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.events).orderBy(desc(schema.events.dateStart));
    return filterText(rows.map((event) => dbEventToDomain(event)), query, (event) => [event.title, event.eventType, event.location, event.impactSummary]);
  }
  return filterText(events, query, (event) => [event.title, event.eventType, event.location, event.impactSummary]);
}

export async function getEventById(id: string) {
  const db = getDb();
  if (db) {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
    if (!event) {
      return undefined;
    }
    const evidence = await db.select().from(schema.eventEvidence).where(eq(schema.eventEvidence.eventId, id));
    return dbEventToDomain(event, evidence);
  }
  return events.find((event) => event.id === id);
}

export async function getTerritories() {
  const db = getDb();
  if (db) {
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
  return territories;
}

export async function getUsers() {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.users);
    return rows.map((user) => dbUserToDomain(user, [], undefined));
  }
  return users;
}

export async function getOperationsData() {
  const db = getDb();
  if (db) {
    const [commissionRows, settingRows, pingRows, userRows] = await Promise.all([
      db.select().from(schema.fieldCommissions).orderBy(desc(schema.fieldCommissions.scheduledAt)),
      db.select().from(schema.locationTrackingSettings),
      db.select().from(schema.delegateLocationPings).orderBy(desc(schema.delegateLocationPings.capturedAt)),
      db.select().from(schema.users),
    ]);
    const pings = pingRows.map(dbPingToDomain);
    return {
      fieldCommissions: commissionRows.map((commission) => ({
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
      })),
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
      pings,
      people: userRows.map((user) => dbUserToDomain(user, [], undefined)),
    };
  }
  return {
    fieldCommissions,
    locationSettings,
    pings: allLocationPings,
    people: users.filter((user) => user.roles.includes("territorial_delegate") || user.roles.includes("field_commissioner")),
  };
}

export async function getCommissionById(id: string) {
  const db = getDb();
  if (db) {
    const [commission] = await db.select().from(schema.fieldCommissions).where(eq(schema.fieldCommissions.id, id)).limit(1);
    if (!commission) {
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
  return fieldCommissions.find((commission) => commission.id === id);
}

export async function getAssistantData() {
  const db = getDb();
  if (db) {
    const [providerRows, promptRows, conversationRows, messageRows] = await Promise.all([
      db.select().from(schema.aiProviderConfigs),
      db.select().from(schema.aiPromptTemplates).orderBy(desc(schema.aiPromptTemplates.updatedAt)),
      db.select().from(schema.aiConversations).orderBy(desc(schema.aiConversations.createdAt)),
      db.select().from(schema.aiMessages).orderBy(desc(schema.aiMessages.createdAt)),
    ]);
    return {
      providerConfigs: providerRows.map((provider) => ({
        id: provider.id,
        providerKey: provider.providerKey,
        displayName: provider.displayName,
        enabled: provider.enabled,
        defaultModel: provider.defaultModel,
        encryptedApiKeyRef: provider.encryptedApiKeyRef,
        priority: provider.priority,
        updatedBy: provider.updatedBy,
        updatedAt: provider.updatedAt.toISOString(),
      })),
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
  return {
    providerConfigs: aiProviderConfigs,
    prompts: aiPromptTemplates,
    conversations: aiConversations,
  };
}

export async function getPromptById(id: string) {
  const db = getDb();
  if (db) {
    const [prompt] = await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, id)).limit(1);
    return prompt ? dbPromptToDomain(prompt) : undefined;
  }
  return aiPromptTemplates.find((prompt) => prompt.id === id);
}

export async function getPrevalenceData() {
  const db = getDb();
  if (db) {
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
  return {
    studies: prevalenceStudies,
    metrics: prevalenceMetrics,
    records: prevalenceRecords,
    byTerritory: territories.map((territory) => ({
      territory,
      value: prevalenceRecords
        .filter((record) => record.territoryId === territory.id)
        .reduce((sum, record) => sum + Number(record.valueNumeric ?? 0), 0),
    })),
  };
}

export async function getReportDefinitions() {
  return reports;
}

export async function getAuditLogs() {
  const db = getDb();
  if (db) {
    const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt));
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
  return auditLogs;
}

export async function getConfiguration() {
  const db = getDb();
  if (db) {
    const [orgRows, providerRows, settingRows] = await Promise.all([
      db.select().from(schema.organizations).limit(1),
      db.select().from(schema.aiProviderConfigs).orderBy(schema.aiProviderConfigs.priority),
      db.select().from(schema.locationTrackingSettings),
    ]);
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
      aiProviderConfigs: providerRows.map((provider) => ({
        id: provider.id,
        providerKey: provider.providerKey,
        displayName: provider.displayName,
        enabled: provider.enabled,
        defaultModel: provider.defaultModel,
        encryptedApiKeyRef: provider.encryptedApiKeyRef,
        priority: provider.priority,
        updatedBy: provider.updatedBy,
        updatedAt: provider.updatedAt.toISOString(),
      })),
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
    };
  }
  return {
    organization,
    aiProviderConfigs,
    locationSettings,
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
  return territories.find((territory) => territory.id === id || stableUuid(territory.id) === id)?.name ?? "Sin territorio";
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
  return users.find((user) => user.id === id || stableUuid(user.id) === id)?.name ?? "Sin asignar";
}

export function nextMemberNumber(recordList: Member[] = members) {
  return `ORG-CHH-${String(recordList.length + 1).padStart(6, "0")}`;
}

export function nextCaseNumber(recordList: HumanRightsCase[] = cases) {
  return `CASO-2026-CHH-${String(recordList.length + 1).padStart(4, "0")}`;
}
