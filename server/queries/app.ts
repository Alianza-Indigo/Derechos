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
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { HumanRightsCase, Member, User } from "@/lib/types";
import { authOptions } from "@/server/auth/options";
import { canAccessCase, canAccessTerritory } from "@/server/permissions/rbac";

export async function getCurrentUser(): Promise<User> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const user = email ? users.find((item) => item.email.toLowerCase() === email.toLowerCase()) : undefined;
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function getDashboardData(user = users[0]) {
  const accessibleCases = cases.filter((record) => canAccessCase(user, record));
  const accessibleMembers = members.filter((member) => canAccessTerritory(user, member.territoryId));
  const accessibleEvents = events.filter((event) => canAccessTerritory(user, event.territoryId));
  const urgentCases = accessibleCases.filter((record) => record.priority === "Urgente" && !["Resuelto", "Archivado"].includes(record.status));
  const activeLocations = allLocationPings.filter((ping) => ping.status !== "deshabilitado");

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
    recentAudit: auditLogs.slice(0, 8),
    activeLocations,
  };
}

export async function listMembers(query?: string) {
  return filterText(members, query, (member) => [member.fullName, member.memberNumber, member.email, member.status]);
}

export async function getMemberById(id: string) {
  return members.find((member) => member.id === id);
}

export async function getMemberByCredentialSlug(slug: string) {
  return members.find((member) => member.credentialSlug === slug);
}

export async function listCases(query?: string) {
  return filterText(cases, query, (record) => [record.caseNumber, record.title, record.category, record.status, record.priority]);
}

export async function getCaseById(id: string) {
  return cases.find((record) => record.id === id);
}

export async function listEvents(query?: string) {
  return filterText(events, query, (event) => [event.title, event.eventType, event.location, event.impactSummary]);
}

export async function getEventById(id: string) {
  return events.find((event) => event.id === id);
}

export async function getTerritories() {
  return territories;
}

export async function getUsers() {
  return users;
}

export async function getOperationsData() {
  return {
    fieldCommissions,
    locationSettings,
    pings: allLocationPings,
    people: users.filter((user) => user.roles.includes("territorial_delegate") || user.roles.includes("field_commissioner")),
  };
}

export async function getCommissionById(id: string) {
  return fieldCommissions.find((commission) => commission.id === id);
}

export async function getAssistantData() {
  return {
    providerConfigs: aiProviderConfigs,
    prompts: aiPromptTemplates,
    conversations: aiConversations,
  };
}

export async function getPromptById(id: string) {
  return aiPromptTemplates.find((prompt) => prompt.id === id);
}

export async function getPrevalenceData() {
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
  return auditLogs;
}

export async function getConfiguration() {
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
  return territories.find((territory) => territory.id === id)?.name ?? "Sin territorio";
}

export function getUserName(id?: string) {
  return users.find((user) => user.id === id)?.name ?? "Sin asignar";
}

export function nextMemberNumber(recordList: Member[] = members) {
  return `ORG-CHH-${String(recordList.length + 1).padStart(6, "0")}`;
}

export function nextCaseNumber(recordList: HumanRightsCase[] = cases) {
  return `CASO-2026-CHH-${String(recordList.length + 1).padStart(4, "0")}`;
}
