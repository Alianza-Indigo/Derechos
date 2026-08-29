import { auditLogs } from "@/lib/mock-data";

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
