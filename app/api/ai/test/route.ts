import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { aiPromptTemplates } from "@/lib/mock-data";
import { runAssistant } from "@/lib/ai/adapters";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";

export async function POST(request: NextRequest) {
  const limit = await rateLimit(clientKey(request, "ai-test"), 10, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Limite temporal de pruebas IA alcanzado." }, { status: 429 });
  }
  const body = (await request.json()) as { promptId?: string; message?: string };
  const db = getDb();
  const [dbPrompt] = db && body.promptId
    ? await db.select().from(schema.aiPromptTemplates).where(eq(schema.aiPromptTemplates.id, body.promptId)).limit(1)
    : [];
  const prompt = dbPrompt
    ? {
      id: dbPrompt.id,
      key: dbPrompt.key,
      name: dbPrompt.name,
      description: dbPrompt.description,
      moduleScope: dbPrompt.moduleScope,
      systemPrompt: dbPrompt.systemPrompt,
      userPromptTemplate: dbPrompt.userPromptTemplate,
      variables: dbPrompt.variables,
      providerKey: dbPrompt.providerKey,
      model: dbPrompt.model ?? undefined,
      temperature: Number(dbPrompt.temperature),
      enabled: dbPrompt.enabled,
      version: dbPrompt.version,
      updatedBy: dbPrompt.updatedBy,
      updatedAt: dbPrompt.updatedAt.toISOString(),
    }
    : aiPromptTemplates.find((item) => item.id === body.promptId) ?? aiPromptTemplates[0];
  const result = await runAssistant({
    prompt,
    message: body.message || "Prueba ficticia de conexion y prompt.",
    context: { entorno: "prueba", datos: "ficticios" },
  });
  return NextResponse.json(result);
}
