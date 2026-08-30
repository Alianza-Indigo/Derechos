import { eq } from "drizzle-orm";
import { auditLogs as auditLogsTable, users as usersTable } from "@/drizzle/schema";
import { getDb } from "@/server/db";

type AuditInput = {
  actorId?: string;
  organizationId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
};

export async function writeAuditLog(input: AuditInput) {
  const db = getDb();
  const actorId = input.actorId && input.actorId !== "system" ? input.actorId : null;
  // La organizacion se toma de la explicita o se resuelve del actor. Los
  // eventos de sistema (sin actor) quedan sin tenant (organization_id null).
  let organizationId = input.organizationId ?? null;
  if (!organizationId && actorId) {
    const [actor] = await db.select({ organizationId: usersTable.organizationId }).from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
    organizationId = actor?.organizationId ?? null;
  }
  await db.insert(auditLogsTable).values({
    organizationId,
    actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.ip,
  });
}
