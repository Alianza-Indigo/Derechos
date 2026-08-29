import { auditLogs } from "@/lib/mock-data";
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
  if (db) {
    await db.insert(auditLogsTable).values({
      actorId: input.actorId === "system" ? null : input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      ip: input.ip,
    });
    return;
  }

  auditLogs.unshift({
    id: `audit_runtime_${crypto.randomUUID()}`,
    actorId: input.actorId ?? "system",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.ip,
    createdAt: new Date().toISOString(),
  });
}
