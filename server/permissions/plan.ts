import { eq, sql } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { planLabel, planLimits } from "@/lib/plans";

type Resource = "users" | "members" | "cases";

const LABELS: Record<Resource, string> = { users: "usuarios", members: "miembros", cases: "casos" };

async function countFor(organizationId: string, resource: Resource): Promise<number> {
  const db = getDb();
  const q = sql<number>`count(*)::int`;
  if (resource === "users") {
    const [{ total }] = await db.select({ total: q }).from(schema.users).where(eq(schema.users.organizationId, organizationId));
    return total;
  }
  if (resource === "members") {
    const [{ total }] = await db.select({ total: q }).from(schema.members).where(eq(schema.members.organizationId, organizationId));
    return total;
  }
  const [{ total }] = await db.select({ total: q }).from(schema.cases).where(eq(schema.cases.organizationId, organizationId));
  return total;
}

// Devuelve un mensaje de error si crear un nuevo recurso excederia el cupo del
// plan del inquilino; null si hay capacidad (o el plan es ilimitado).
export async function planCapacityError(organizationId: string, resource: Resource): Promise<string | null> {
  const db = getDb();
  const [org] = await db
    .select({ plan: schema.organizations.plan })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  const plan = org?.plan ?? "gratuito";
  const limits = planLimits(plan);
  const limit = resource === "users" ? limits.maxUsers : resource === "members" ? limits.maxMembers : limits.maxCases;
  if (limit == null) {
    return null;
  }
  const total = await countFor(organizationId, resource);
  if (total >= limit) {
    return `Alcanzaste el limite de tu plan ${planLabel(plan)} (${limit} ${LABELS[resource]}). Mejora el plan para agregar mas.`;
  }
  return null;
}
