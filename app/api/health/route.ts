import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

// Health check publico para monitoreo/uptime. No expone datos sensibles:
// solo indica si el servicio y la base de datos responden.
export async function GET() {
  const startedAt = Date.now();
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", database: "up", latencyMs: Date.now() - startedAt, time: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "down", latencyMs: Date.now() - startedAt, time: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
