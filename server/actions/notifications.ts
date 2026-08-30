"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/queries/app";

type ActionResult = { ok: boolean; message: string };

// Marca como leidos los avisos de la organizacion del usuario. Con `id` marca
// uno; sin `id`, todos los pendientes de la organizacion.
export async function markNotificationsReadAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = getDb();
  const id = formData.get("id");
  const base = and(eq(schema.notifications.organizationId, user.organizationId), isNull(schema.notifications.readAt));
  await db
    .update(schema.notifications)
    .set({ readAt: new Date(), readBy: user.id })
    .where(typeof id === "string" && id ? and(base, eq(schema.notifications.id, id)) : base);
  revalidatePath("/notificaciones");
  return { ok: true, message: "Avisos marcados como leidos." };
}
