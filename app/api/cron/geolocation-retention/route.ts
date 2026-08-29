import { NextResponse } from "next/server";
import { pruneLocationRetentionAction } from "@/server/actions/platform";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const result = await pruneLocationRetentionAction();
  return NextResponse.json(result);
}
