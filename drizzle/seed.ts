import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { roleLabels } from "@/lib/constants";
import { stableUuid } from "@/lib/stable-id";
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
} from "@/lib/mock-data";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";

async function main() {
  const demoHash = await hash(process.env.DEMO_PASSWORD || "demo-seguro", 12);
  const summary = {
    superAdmin: users.find((user) => user.roles.includes("super_admin"))?.email,
    passwordHashPreview: `${demoHash.slice(0, 12)}...`,
    territories: territories.length,
    members: members.length,
    cases: cases.length,
    events: events.length,
    prevalenceStudies: prevalenceStudies.length,
    prevalenceMetrics: prevalenceMetrics.length,
    prevalenceRecords: prevalenceRecords.length,
    fieldCommissions: fieldCommissions.length,
    aiPrompts: aiPromptTemplates.length,
    aiProviders: aiProviderConfigs.length,
  };

  const db = getDb();
  if (!db) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("Seed tipado listo. Configura DATABASE_URL para insertar en Postgres/Neon.");
    return;
  }

  const roleIds = Object.fromEntries(Object.keys(roleLabels).map((key) => [key, stableUuid(`role:${key}`)]));

  await db.insert(schema.organizations).values({
    id: stableUuid(organization.id),
    name: organization.name,
    legalName: organization.legalName,
    logoUrl: organization.logoUrl,
    primaryColor: organization.primaryColor,
    country: organization.country,
    geolocationEnabled: organization.geolocationEnabled,
    aiEnabled: organization.aiEnabled,
  }).onConflictDoNothing();

  await db.insert(schema.roles).values(Object.entries(roleLabels).map(([key, name]) => ({
    id: roleIds[key],
    key,
    name,
    description: `Rol base: ${name}`,
  }))).onConflictDoNothing();

  await db.insert(schema.territories).values(territories.map((territory) => ({
    id: stableUuid(territory.id),
    type: territory.type,
    name: territory.name,
    countryCode: territory.countryCode,
    stateCode: territory.stateCode,
    cityName: territory.cityName,
    latitude: String(territory.latitude),
    longitude: String(territory.longitude),
    parentId: territory.parentId ? stableUuid(territory.parentId) : null,
  }))).onConflictDoNothing();

  await db.insert(schema.users).values(users.map((user) => ({
    id: stableUuid(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    passwordHash: demoHash,
    providerId: null,
    status: user.status,
  }))).onConflictDoNothing();

  await db.insert(schema.userRoles).values(users.flatMap((user) => user.roles.map((role) => ({
    userId: stableUuid(user.id),
    roleId: roleIds[role],
    scopeType: user.territoryId ? "territory" : "global",
    scopeId: user.territoryId ? stableUuid(user.territoryId) : null,
  })))).onConflictDoNothing();

  // Super administrador desde variables de entorno: cuenta duena de la
  // plataforma con acceso total (rol super_admin => permiso "*"). Se
  // (re)crea en cada corrida del seed; su contrasena se sincroniza con
  // SUPERADMIN_PASSWORD para que el owner nunca quede bloqueado.
  const superEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const superPassword = process.env.SUPERADMIN_PASSWORD;
  if (superEmail && superPassword) {
    const superHash = await hash(superPassword, 12);
    await db.insert(schema.users).values({
      id: stableUuid(`superadmin:${superEmail}`),
      name: process.env.SUPERADMIN_NAME || "Super Administrador",
      email: superEmail,
      phone: null,
      passwordHash: superHash,
      providerId: null,
      status: "active",
    }).onConflictDoUpdate({
      target: schema.users.email,
      set: { passwordHash: superHash, status: "active" },
    });
    const [superUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, superEmail)).limit(1);
    if (superUser) {
      await db.insert(schema.userRoles).values({
        userId: superUser.id,
        roleId: roleIds.super_admin,
        scopeType: "global",
        scopeId: null,
      }).onConflictDoNothing();
    }
    console.log(`Super administrador asegurado: ${superEmail}`);
  } else {
    console.log("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD no definidos: no se creo super admin desde env.");
  }

  await db.insert(schema.members).values(members.map((member) => ({
    id: stableUuid(member.id),
    memberNumber: member.memberNumber,
    userId: member.userId ? stableUuid(member.userId) : null,
    fullName: member.fullName,
    birthDate: new Date(member.birthDate),
    gender: member.gender,
    phone: member.phone,
    email: member.email,
    address: member.address,
    territoryId: stableUuid(member.territoryId),
    status: member.status,
    joinedAt: new Date(member.joinedAt),
  }))).onConflictDoNothing();

  await db.insert(schema.memberCredentials).values(members.map((member) => ({
    id: stableUuid(`credential:${member.id}`),
    memberId: stableUuid(member.id),
    qrToken: stableUuid(`qr:${member.credentialSlug}`),
    publicSlug: member.credentialSlug,
    issuedAt: new Date(member.joinedAt),
    expiresAt: new Date(member.credentialExpiresAt),
    status: member.credentialStatus,
  }))).onConflictDoNothing();

  await db.insert(schema.cases).values(cases.map((record) => ({
    id: stableUuid(record.id),
    caseNumber: record.caseNumber,
    title: record.title,
    description: record.description,
    category: record.category,
    priority: record.priority,
    status: record.status as (typeof schema.caseStatusEnum.enumValues)[number],
    territoryId: stableUuid(record.territoryId),
    openedBy: stableUuid(record.openedBy),
    assignedTo: stableUuid(record.assignedTo),
    openedAt: new Date(record.openedAt),
    closedAt: null,
    dueDate: record.dueDate ? new Date(record.dueDate) : null,
  }))).onConflictDoNothing();

  await db.insert(schema.casePeople).values(cases.flatMap((record) => record.persons.map((person) => ({
    id: stableUuid(person.id),
    caseId: stableUuid(record.id),
    personType: person.personType,
    name: person.name,
    contact: person.contact,
    demographicData: person.demographicData,
    consentStatus: person.consentStatus,
  })))).onConflictDoNothing();

  await db.insert(schema.caseActions).values(cases.flatMap((record) => record.actions.map((action) => ({
    id: stableUuid(action.id),
    caseId: stableUuid(record.id),
    actionType: action.actionType,
    description: action.description,
    dueDate: action.dueDate ? new Date(action.dueDate) : null,
    completedAt: action.completedAt ? new Date(action.completedAt) : null,
    createdBy: stableUuid(action.createdBy),
  })))).onConflictDoNothing();

  await db.insert(schema.caseNotes).values(cases.map((record) => ({
    id: stableUuid(`note:${record.id}`),
    caseId: stableUuid(record.id),
    note: record.internalNotes.join("\n"),
    visibility: "internal",
    createdBy: stableUuid(record.openedBy),
  }))).onConflictDoNothing();

  await db.insert(schema.caseEvidence).values(cases.flatMap((record) => record.evidence.map((evidence) => ({
    id: stableUuid(evidence.id),
    caseId: stableUuid(record.id),
    fileUrl: evidence.fileUrl,
    fileType: evidence.fileType,
    description: evidence.description,
    uploadedBy: stableUuid(evidence.uploadedBy),
    createdAt: new Date(evidence.createdAt),
  })))).onConflictDoNothing();

  await db.insert(schema.events).values(events.map((event) => ({
    id: stableUuid(event.id),
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    dateStart: new Date(event.dateStart),
    dateEnd: new Date(event.dateEnd),
    location: event.location,
    territoryId: stableUuid(event.territoryId),
    organizerId: stableUuid(event.organizerId),
    attendeesCount: event.attendeesCount,
    institutions: event.institutions,
    impactSummary: event.impactSummary,
    indicators: event.indicators,
  }))).onConflictDoNothing();

  await db.insert(schema.eventEvidence).values(events.flatMap((event) => event.evidence.map((evidence) => ({
    id: stableUuid(evidence.id),
    eventId: stableUuid(event.id),
    fileUrl: evidence.fileUrl,
    type: evidence.fileType,
    description: evidence.description,
    createdAt: new Date(evidence.createdAt),
  })))).onConflictDoNothing();

  await db.insert(schema.prevalenceStudies).values(prevalenceStudies.map((study) => ({
    id: stableUuid(study.id),
    name: study.name,
    description: study.description,
    methodology: study.methodology,
    startDate: new Date(study.startDate),
    endDate: new Date(study.endDate),
    status: study.status,
  }))).onConflictDoNothing();

  await db.insert(schema.prevalenceMetrics).values(prevalenceMetrics.map((metric) => ({
    id: stableUuid(metric.id),
    studyId: stableUuid(metric.studyId),
    indicatorKey: metric.indicatorKey,
    label: metric.label,
    description: metric.description,
    valueType: metric.valueType,
  }))).onConflictDoNothing();

  await db.insert(schema.prevalenceRecords).values(prevalenceRecords.map((record) => ({
    id: stableUuid(record.id),
    studyId: stableUuid(record.studyId),
    metricId: stableUuid(record.metricId),
    territoryId: stableUuid(record.territoryId),
    valueNumeric: record.valueNumeric === undefined ? null : String(record.valueNumeric),
    valueText: record.valueText,
    sampleSize: record.sampleSize,
    source: record.source,
    measuredAt: new Date(record.measuredAt),
  }))).onConflictDoNothing();

  await db.insert(schema.fieldCommissions).values(fieldCommissions.map((commission) => ({
    id: stableUuid(commission.id),
    title: commission.title,
    commissionType: commission.commissionType,
    description: commission.description,
    assignedTo: stableUuid(commission.assignedTo),
    territoryId: stableUuid(commission.territoryId),
    relatedCaseId: commission.relatedCaseId ? stableUuid(commission.relatedCaseId) : null,
    relatedEventId: commission.relatedEventId ? stableUuid(commission.relatedEventId) : null,
    status: commission.status,
    scheduledAt: new Date(commission.scheduledAt),
    completedAt: commission.completedAt ? new Date(commission.completedAt) : null,
  }))).onConflictDoNothing();

  await db.insert(schema.locationTrackingSettings).values(locationSettings.map((setting) => ({
    id: stableUuid(setting.id),
    userId: stableUuid(setting.userId),
    enabled: setting.enabled,
    mode: setting.mode,
    allowedDays: setting.allowedDays,
    allowedHours: setting.allowedHours,
    retentionDays: setting.retentionDays,
    disabledReason: setting.disabledReason,
    updatedBy: stableUuid(setting.updatedBy),
    updatedAt: new Date(setting.updatedAt),
  }))).onConflictDoNothing();

  await db.insert(schema.territoryLocationSettings).values(territories.map((territory) => ({
    id: stableUuid(`territory-location:${territory.id}`),
    territoryId: stableUuid(territory.id),
    enabled: true,
    mode: "manual_check_in" as const,
    retentionDays: 30,
    updatedBy: stableUuid("u_admin"),
  }))).onConflictDoNothing();

  await db.insert(schema.delegateLocationPings).values(allLocationPings.map((ping) => ({
    id: stableUuid(ping.id),
    userId: stableUuid(ping.userId),
    fieldCommissionId: ping.fieldCommissionId ? stableUuid(ping.fieldCommissionId) : null,
    territoryId: stableUuid(ping.territoryId),
    latitude: String(ping.latitude),
    longitude: String(ping.longitude),
    accuracyMeters: ping.accuracyMeters,
    captureMode: ping.captureMode,
    batteryLevel: ping.batteryLevel,
    status: ping.status,
    capturedAt: new Date(ping.capturedAt),
  }))).onConflictDoNothing();

  await db.insert(schema.aiProviderConfigs).values(aiProviderConfigs.map((provider) => ({
    id: stableUuid(provider.id),
    providerKey: provider.providerKey,
    displayName: provider.displayName,
    enabled: provider.enabled,
    defaultModel: provider.defaultModel,
    encryptedApiKeyRef: provider.encryptedApiKeyRef,
    priority: provider.priority,
    updatedBy: stableUuid(provider.updatedBy),
    updatedAt: new Date(provider.updatedAt),
  }))).onConflictDoNothing();

  await db.insert(schema.aiPromptTemplates).values(aiPromptTemplates.map((prompt) => ({
    id: stableUuid(prompt.id),
    key: prompt.key,
    name: prompt.name,
    description: prompt.description,
    moduleScope: prompt.moduleScope,
    systemPrompt: prompt.systemPrompt,
    userPromptTemplate: prompt.userPromptTemplate,
    variables: prompt.variables,
    providerKey: prompt.providerKey,
    model: prompt.model,
    temperature: String(prompt.temperature),
    enabled: prompt.enabled,
    version: prompt.version,
    updatedBy: stableUuid(prompt.updatedBy),
    updatedAt: new Date(prompt.updatedAt),
  }))).onConflictDoNothing();

  await db.insert(schema.aiConversations).values(aiConversations.map((conversation) => ({
    id: stableUuid(conversation.id),
    userId: stableUuid(conversation.userId),
    relatedCaseId: conversation.relatedCaseId ? stableUuid(conversation.relatedCaseId) : null,
    relatedEventId: conversation.relatedEventId ? stableUuid(conversation.relatedEventId) : null,
    fieldCommissionId: conversation.fieldCommissionId ? stableUuid(conversation.fieldCommissionId) : null,
    promptTemplateId: stableUuid(conversation.promptTemplateId),
    title: conversation.title,
    status: conversation.status,
    createdAt: new Date(conversation.createdAt),
  }))).onConflictDoNothing();

  await db.insert(schema.aiMessages).values(aiConversations.flatMap((conversation) => conversation.messages.map((message) => ({
    id: stableUuid(message.id),
    conversationId: stableUuid(conversation.id),
    role: message.role,
    content: message.content,
    metadata: message.metadata ?? {},
    createdAt: new Date(message.createdAt),
  })))).onConflictDoNothing();

  await db.insert(schema.auditLogs).values(auditLogs.map((log) => ({
    id: stableUuid(log.id),
    actorId: stableUuid(log.actorId),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    before: log.before,
    after: log.after,
    ip: log.ip,
    createdAt: new Date(log.createdAt),
  }))).onConflictDoNothing();

  console.log(JSON.stringify(summary, null, 2));
  console.log("Seed insertado en Postgres/Neon.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
