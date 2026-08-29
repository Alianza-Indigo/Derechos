import { NextResponse } from "next/server";
import { pruneLocationRetentionAction } from "@/server/actions/platform";

// Vercel Cron invoca por GET con `Authorization: Bearer $CRON_SECRET`.
// Se admite tambien POST para ejecucion manual con el mismo secreto.
async function handle(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const result = await pruneLocationRetentionAction();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
