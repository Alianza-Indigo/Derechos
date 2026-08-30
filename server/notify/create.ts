import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";

type NotificationInput = {
  organizationId: string;
  kind: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  href?: string;
};

// Crea un aviso operativo para una organizacion. Best-effort: si falla, no debe
// tumbar la accion que lo dispara (p. ej. el alta de un caso).
export async function createNotification(input: NotificationInput) {
  try {
    const db = getDb();
    await db.insert(schema.notifications).values({
      organizationId: input.organizationId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      href: input.href ?? null,
    });
  } catch (error) {
    console.error("No se pudo crear la notificacion:", error);
  }
}
