import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";

export async function logCredentialVerification(input: {
  publicSlug: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = getDb();
  const [credential] = await db
    .select({ id: schema.memberCredentials.id, organizationId: schema.memberCredentials.organizationId })
    .from(schema.memberCredentials)
    .where(eq(schema.memberCredentials.publicSlug, input.publicSlug))
    .limit(1);

  if (!credential) {
    return;
  }

  await db.insert(schema.credentialVerificationLogs).values({
    organizationId: credential.organizationId,
    credentialId: credential.id,
    publicSlug: input.publicSlug,
    ipHash: input.ip ? digest(input.ip) : null,
    userAgentHash: input.userAgent ? digest(input.userAgent) : null,
  });
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
