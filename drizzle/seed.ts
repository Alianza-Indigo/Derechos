import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import * as s from "@/drizzle/schema";
import { roleLabels } from "@/lib/constants";
import { getDb } from "@/server/db";
import {
  aiConversations,
  aiProviderConfigs,
  aiPromptTemplates,
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
  territories,
  users,
} from "@/lib/seed-data";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-seguro";

async function insertMany<T>(table: Parameters<ReturnType<typeof getDb>["insert"]>[0], rows: T[]) {
  if (rows.length) {
    await getDb().insert(table).values(rows);
  }
}

async function truncateAll() {
  const db = getDb();
  // Orden inverso a las dependencias de llaves foraneas.
  const tables = [
    s.aiFeedback,
    s.aiRuns,
    s.aiMessages,
    s.aiConversations,
    s.aiPromptTemplates,
    s.aiProviderConfigs,
    s.delegateLocationPings,
    s.locationTrackingSettings,
    s.fieldCommissions,
    s.caseEvidence,
    s.caseActions,
    s.casePeople,
    s.cases,
    s.eventEvidence,
    s.events,
    s.prevalenceRecords,
    s.prevalenceMetrics,
    s.prevalenceStudies,
    s.memberCredentials,
    s.members,
    s.auditLogs,
    s.userRoles,
    s.reports,
    s.users,
    s.territories,
    s.roles,
    s.organizations,
  ];
  for (const table of tables) {
    await db.delete(table);
  }
}

async function main() {
  const db = getDb();
  if (!process.env.DATABASE_URL) {
    throw new Error("Define DATABASE_URL antes de ejecutar el seed (ver .env.example).");
  }

  await truncateAll();

  // Organizacion
  await db.insert(s.organizations).values({
    id: organization.id,
    name: organization.name,
    legalName: organization.legalName,
    logoUrl: organization.logoUrl,
    primaryColor: organization.primaryColor,
    country: organization.country,
    geolocationEnabled: organization.geolocationEnabled,
    aiEnabled: organization.aiEnabled,
    locationRetentionDays: organization.locationRetentionDays,
  });

  // Roles (id = clave del rol)
  await insertMany(
    s.roles,
    Object.entries(roleLabels).map(([key, name]) => ({ id: key, key, name, description: name })),
  );

  // Territorios (ya ordenados padre -> hijo)
  await insertMany(
    s.territories,
    territories.map((territory) => ({
      id: territory.id,
      type: territory.type,
      name: territory.name,
      countryCode: territory.countryCode,
      stateCode: territory.stateCode ?? null,
      cityName: territory.cityName ?? null,
      latitude: String(territory.latitude),
      longitude: String(territory.longitude),
      parentId: territory.parentId ?? null,
    })),
  );

  // Usuarios + hash bcrypt real
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  await insertMany(
    s.users,
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      passwordHash,
      status: user.status,
      territoryId: user.territoryId ?? null,
    })),
  );

  // Asignacion de roles
  await insertMany(
    s.userRoles,
    users.flatMap((user) => user.roles.map((role) => ({ userId: user.id, roleId: role, scopeType: "global" }))),
  );

  // Miembros + credenciales
  await insertMany(
    s.members,
    members.map((member) => ({
      id: member.id,
      memberNumber: member.memberNumber,
      userId: member.userId ?? null,
      fullName: member.fullName,
      birthDate: member.birthDate ? new Date(member.birthDate) : null,
      gender: member.gender,
      phone: member.phone,
      email: member.email,
      address: member.address,
      territoryId: member.territoryId,
      status: member.status,
      joinedAt: new Date(member.joinedAt),
    })),
  );
  await insertMany(
    s.memberCredentials,
    members.map((member) => ({
      memberId: member.id,
      qrToken: `qr-${member.id}`,
      publicSlug: member.credentialSlug,
      expiresAt: member.credentialExpiresAt ? new Date(member.credentialExpiresAt) : null,
      status: member.credentialStatus,
    })),
  );

  // Casos + hijos
  await insertMany(
    s.cases,
    cases.map((record) => ({
      id: record.id,
      caseNumber: record.caseNumber,
      title: record.title,
      description: record.description,
      category: record.category,
      priority: record.priority,
      status: record.status as (typeof s.caseStatusEnum.enumValues)[number],
      territoryId: record.territoryId,
      openedBy: record.openedBy,
      assignedTo: record.assignedTo,
      openedAt: new Date(record.openedAt),
      dueDate: record.dueDate ? new Date(record.dueDate) : null,
      internalNotes: record.internalNotes,
    })),
  );
  await insertMany(
    s.casePeople,
    cases.flatMap((record) =>
      record.persons.map((person) => ({
        id: person.id,
        caseId: record.id,
        personType: person.personType,
        name: person.name,
        contact: person.contact,
        demographicData: person.demographicData,
        consentStatus: person.consentStatus,
      })),
    ),
  );
  await insertMany(
    s.caseActions,
    cases.flatMap((record) =>
      record.actions.map((action) => ({
        id: action.id,
        caseId: record.id,
        actionType: action.actionType,
        description: action.description,
        dueDate: action.dueDate ? new Date(action.dueDate) : null,
        completedAt: action.completedAt ? new Date(action.completedAt) : null,
        createdBy: action.createdBy,
      })),
    ),
  );
  await insertMany(
    s.caseEvidence,
    cases.flatMap((record) =>
      record.evidence.map((item) => ({
        id: item.id,
        caseId: record.id,
        fileUrl: item.fileUrl,
        fileType: item.fileType,
        description: item.description,
        uploadedBy: item.uploadedBy,
        createdAt: new Date(item.createdAt),
      })),
    ),
  );

  // Eventos + evidencia
  await insertMany(
    s.events,
    events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      dateStart: new Date(event.dateStart),
      dateEnd: new Date(event.dateEnd),
      location: event.location,
      territoryId: event.territoryId,
      organizerId: event.organizerId,
      attendeesCount: event.attendeesCount,
      institutions: event.institutions,
      impactSummary: event.impactSummary,
      indicators: event.indicators,
    })),
  );
  await insertMany(
    s.eventEvidence,
    events.flatMap((event) =>
      event.evidence.map((item) => ({
        id: item.id,
        eventId: event.id,
        fileUrl: item.fileUrl,
        type: item.fileType,
        description: item.description,
        createdAt: new Date(item.createdAt),
      })),
    ),
  );

  // Prevalencia
  await insertMany(
    s.prevalenceStudies,
    prevalenceStudies.map((study) => ({
      id: study.id,
      name: study.name,
      description: study.description,
      methodology: study.methodology,
      startDate: new Date(study.startDate),
      endDate: new Date(study.endDate),
      status: study.status,
    })),
  );
  await insertMany(
    s.prevalenceMetrics,
    prevalenceMetrics.map((metric) => ({
      id: metric.id,
      studyId: metric.studyId,
      indicatorKey: metric.indicatorKey,
      label: metric.label,
      description: metric.description,
      valueType: metric.valueType,
    })),
  );
  await insertMany(
    s.prevalenceRecords,
    prevalenceRecords.map((record) => ({
      id: record.id,
      studyId: record.studyId,
      metricId: record.metricId,
      territoryId: record.territoryId,
      valueNumeric: record.valueNumeric === undefined ? null : String(record.valueNumeric),
      valueText: record.valueText ?? null,
      sampleSize: record.sampleSize ?? null,
      source: record.source,
      measuredAt: new Date(record.measuredAt),
    })),
  );

  // Comisiones + check-ins
  await insertMany(
    s.fieldCommissions,
    fieldCommissions.map((commission) => ({
      id: commission.id,
      title: commission.title,
      commissionType: commission.commissionType,
      description: commission.description,
      assignedTo: commission.assignedTo,
      territoryId: commission.territoryId,
      relatedCaseId: commission.relatedCaseId ?? null,
      relatedEventId: commission.relatedEventId ?? null,
      status: commission.status,
      scheduledAt: new Date(commission.scheduledAt),
      completedAt: commission.completedAt ? new Date(commission.completedAt) : null,
    })),
  );
  await insertMany(
    s.delegateLocationPings,
    allLocationPings.map((ping) => ({
      id: ping.id,
      userId: ping.userId,
      fieldCommissionId: ping.fieldCommissionId ?? null,
      territoryId: ping.territoryId,
      latitude: String(ping.latitude),
      longitude: String(ping.longitude),
      accuracyMeters: ping.accuracyMeters,
      captureMode: ping.captureMode,
      batteryLevel: ping.batteryLevel ?? null,
      status: ping.status,
      capturedAt: new Date(ping.capturedAt),
    })),
  );
  await insertMany(
    s.locationTrackingSettings,
    locationSettings.map((setting) => ({
      id: setting.id,
      userId: setting.userId,
      enabled: setting.enabled,
      mode: setting.mode,
      allowedDays: setting.allowedDays,
      allowedHours: setting.allowedHours,
      retentionDays: setting.retentionDays,
      disabledReason: setting.disabledReason ?? null,
      updatedBy: setting.updatedBy,
    })),
  );

  // IA: proveedores, prompts, conversaciones
  await insertMany(
    s.aiProviderConfigs,
    aiProviderConfigs.map((provider) => ({
      id: provider.id,
      providerKey: provider.providerKey,
      displayName: provider.displayName,
      enabled: provider.enabled,
      defaultModel: provider.defaultModel,
      encryptedApiKeyRef: provider.encryptedApiKeyRef,
      priority: provider.priority,
      updatedBy: provider.updatedBy,
    })),
  );
  await insertMany(
    s.aiPromptTemplates,
    aiPromptTemplates.map((prompt) => ({
      id: prompt.id,
      key: prompt.key,
      name: prompt.name,
      description: prompt.description,
      moduleScope: prompt.moduleScope,
      systemPrompt: prompt.systemPrompt,
      userPromptTemplate: prompt.userPromptTemplate,
      variables: prompt.variables,
      providerKey: prompt.providerKey,
      model: prompt.model ?? null,
      temperature: String(prompt.temperature),
      enabled: prompt.enabled,
      version: prompt.version,
      updatedBy: prompt.updatedBy,
    })),
  );
  await insertMany(
    s.aiConversations,
    aiConversations.map((conversation) => ({
      id: conversation.id,
      userId: conversation.userId,
      relatedCaseId: conversation.relatedCaseId ?? null,
      relatedEventId: conversation.relatedEventId ?? null,
      fieldCommissionId: conversation.fieldCommissionId ?? null,
      promptTemplateId: conversation.promptTemplateId,
      title: conversation.title,
      status: conversation.status,
      createdAt: new Date(conversation.createdAt),
    })),
  );
  await insertMany(
    s.aiMessages,
    aiConversations.flatMap((conversation) =>
      conversation.messages.map((message) => ({
        id: message.id,
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        metadata: message.metadata ?? {},
        createdAt: new Date(message.createdAt),
      })),
    ),
  );

  // Auditoria
  await insertMany(
    s.auditLogs,
    auditLogs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      after: log.after ?? null,
      ip: log.ip ?? null,
      createdAt: new Date(log.createdAt),
    })),
  );

  const [{ count: userCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.users);
  console.log(
    JSON.stringify(
      {
        organizacion: organization.name,
        usuarios: userCount,
        territorios: territories.length,
        miembros: members.length,
        casos: cases.length,
        eventos: events.length,
        prompts: aiPromptTemplates.length,
        proveedoresIA: aiProviderConfigs.length,
        passwordHashPreview: `${passwordHash.slice(0, 12)}...`,
      },
      null,
      2,
    ),
  );
  console.log("Seed aplicado a la base de datos.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
