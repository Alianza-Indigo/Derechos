import { and, desc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/queries/app";
import { isPlatformOwner } from "@/server/permissions/platform";

export type OrganizationRow = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  code: string;
  country: string;
  status: string;
  plan: string;
  primaryColor: string;
  customDomain: string | null;
  createdAt: string;
  counts: { users: number; members: number; cases: number };
};

// Verifica que quien invoca sea la duena de la plataforma. Cualquier otra
// cuenta (incluidos los super_admin de un inquilino) recibe notFound/redirect.
export async function requirePlatformOwner() {
  const user = await getCurrentUser();
  if (!isPlatformOwner(user)) {
    redirect("/dashboard");
  }
  return user;
}

// Listado transversal de TODAS las organizaciones (cruza inquilinos a
// proposito). Solo accesible para la duena de la plataforma.
export async function listOrganizations(): Promise<OrganizationRow[]> {
  await requirePlatformOwner();
  const db = getDb();
  const orgs = await db.select().from(schema.organizations).orderBy(desc(schema.organizations.createdAt));

  const [userCounts, memberCounts, caseCounts] = await Promise.all([
    db
      .select({ organizationId: schema.users.organizationId, total: sql<number>`count(*)::int` })
      .from(schema.users)
      .groupBy(schema.users.organizationId),
    db
      .select({ organizationId: schema.members.organizationId, total: sql<number>`count(*)::int` })
      .from(schema.members)
      .groupBy(schema.members.organizationId),
    db
      .select({ organizationId: schema.cases.organizationId, total: sql<number>`count(*)::int` })
      .from(schema.cases)
      .groupBy(schema.cases.organizationId),
  ]);

  const usersByOrg = new Map(userCounts.map((row) => [row.organizationId, row.total]));
  const membersByOrg = new Map(memberCounts.map((row) => [row.organizationId, row.total]));
  const casesByOrg = new Map(caseCounts.map((row) => [row.organizationId, row.total]));

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    legalName: org.legalName,
    slug: org.slug,
    code: org.code,
    country: org.country,
    status: org.status,
    plan: org.plan,
    primaryColor: org.primaryColor,
    customDomain: org.customDomain,
    createdAt: org.createdAt.toISOString(),
    counts: {
      users: usersByOrg.get(org.id) ?? 0,
      members: membersByOrg.get(org.id) ?? 0,
      cases: casesByOrg.get(org.id) ?? 0,
    },
  }));
}

export type PlatformStats = {
  orgs: { total: number; active: number; pending: number; suspended: number };
  byPlan: { gratuito: number; pro: number; institucional: number };
  totals: { users: number; members: number; cases: number };
};

// Metricas transversales de la plataforma (todas las organizaciones).
export async function getPlatformStats(): Promise<PlatformStats> {
  await requirePlatformOwner();
  const db = getDb();
  const count = sql<number>`count(*)::int`;
  const [orgs, users, members, cases] = await Promise.all([
    db.select({ status: schema.organizations.status, plan: schema.organizations.plan }).from(schema.organizations),
    db.select({ total: count }).from(schema.users),
    db.select({ total: count }).from(schema.members),
    db.select({ total: count }).from(schema.cases),
  ]);
  const by = (key: "status" | "plan", value: string) => orgs.filter((o) => o[key] === value).length;
  return {
    orgs: { total: orgs.length, active: by("status", "active"), pending: by("status", "pending"), suspended: by("status", "suspended") },
    byPlan: { gratuito: by("plan", "gratuito"), pro: by("plan", "pro"), institucional: by("plan", "institucional") },
    totals: { users: users[0]?.total ?? 0, members: members[0]?.total ?? 0, cases: cases[0]?.total ?? 0 },
  };
}

export type OrgAdmin = { id: string; name: string; email: string; status: string };
export type OrgActivity = { id: string; action: string; entityType: string; createdAt: string; actorName: string | null };
export type OrganizationDetail = OrganizationRow & { admins: OrgAdmin[]; activity: OrgActivity[] };

// Ficha completa de una organizacion: datos, conteos, administradores y
// actividad reciente. Solo la duena de la plataforma.
export async function getOrganizationDetail(id: string): Promise<OrganizationDetail | null> {
  await requirePlatformOwner();
  const db = getDb();
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id)).limit(1);
  if (!org) {
    return null;
  }
  const count = sql<number>`count(*)::int`;
  const [[users], [members], [cases], admins, activity] = await Promise.all([
    db.select({ total: count }).from(schema.users).where(eq(schema.users.organizationId, id)),
    db.select({ total: count }).from(schema.members).where(eq(schema.members.organizationId, id)),
    db.select({ total: count }).from(schema.cases).where(eq(schema.cases.organizationId, id)),
    db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, status: schema.users.status })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(and(eq(schema.users.organizationId, id), eq(schema.roles.key, "super_admin"))),
    db
      .select({ id: schema.auditLogs.id, action: schema.auditLogs.action, entityType: schema.auditLogs.entityType, createdAt: schema.auditLogs.createdAt, actorName: schema.users.name })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(eq(schema.auditLogs.organizationId, id))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(15),
  ]);
  return {
    id: org.id,
    name: org.name,
    legalName: org.legalName,
    slug: org.slug,
    code: org.code,
    country: org.country,
    status: org.status,
    plan: org.plan,
    primaryColor: org.primaryColor,
    customDomain: org.customDomain,
    createdAt: org.createdAt.toISOString(),
    counts: { users: users?.total ?? 0, members: members?.total ?? 0, cases: cases?.total ?? 0 },
    admins: admins.map((a) => ({ id: a.id, name: a.name, email: a.email, status: a.status })),
    activity: activity.map((a) => ({ id: a.id, action: a.action, entityType: a.entityType, createdAt: a.createdAt.toISOString(), actorName: a.actorName })),
  };
}

// Estado de una organizacion por slug o codigo (para diagnostico/login).
export async function getOrganizationStatus(idOrSlug: string) {
  const db = getDb();
  const [org] = await db
    .select({ id: schema.organizations.id, status: schema.organizations.status })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, idOrSlug))
    .limit(1);
  return org?.status ?? null;
}
