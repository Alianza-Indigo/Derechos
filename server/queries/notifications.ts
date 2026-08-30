import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/queries/app";

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

// Conteo de avisos sin leer de la organizacion del usuario (para la campana).
export async function getUnreadNotificationCount(): Promise<number> {
  const user = await getCurrentUser();
  const db = getDb();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.organizationId, user.organizationId), isNull(schema.notifications.readAt)));
  return row?.total ?? 0;
}

// Ultimos avisos de la organizacion (leidos y no leidos).
export async function listNotifications(limit = 50): Promise<NotificationRow[]> {
  const user = await getCurrentUser();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.organizationId, user.organizationId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  }));
}
