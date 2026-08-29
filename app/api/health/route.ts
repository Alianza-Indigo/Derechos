import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

// Health check publico para monitoreo/uptime. No expone datos sensibles:
// solo indica si el servicio, la base de datos y el almacenamiento (Blob)
// responden.
export async function GET() {
  const startedAt = Date.now();

  let database: "up" | "down" = "down";
  try {
    await getDb().execute(sql`select 1`);
    database = "up";
  } catch {
    database = "down";
  }

  // Blob: "not_configured" si no hay token; "up" si responde a un listado
  // minimo; "down" si esta configurado pero falla.
  let blob: "up" | "down" | "not_configured" = "not_configured";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await list({ limit: 1 });
      blob = "up";
    } catch {
      blob = "down";
    }
  }

  const healthy = database === "up" && blob !== "down";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      blob,
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
