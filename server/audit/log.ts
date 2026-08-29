import { auditLogs as auditLogsTable } from "@/drizzle/schema";
import { getDb } from "@/server/db";

type AuditInput = {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
};

export async function writeAuditLog(input: AuditInput) {
  const db = getDb();
  await db.insert(auditLogsTable).values({
    actorId: input.actorId && input.actorId !== "system" ? input.actorId : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.ip,
  });
}
