import { desc, eq, sql } from "drizzle-orm";
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
    customDomain: org.customDomain,
    createdAt: org.createdAt.toISOString(),
    counts: {
      users: usersByOrg.get(org.id) ?? 0,
      members: membersByOrg.get(org.id) ?? 0,
      cases: casesByOrg.get(org.id) ?? 0,
    },
  }));
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
