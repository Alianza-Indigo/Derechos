import { NextRequest, NextResponse } from "next/server";
import { aiPromptTemplates } from "@/lib/mock-data";
import { runAssistant } from "@/lib/ai/adapters";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { promptId?: string; message?: string };
  const prompt = aiPromptTemplates.find((item) => item.id === body.promptId) ?? aiPromptTemplates[0];
  const result = await runAssistant({
    prompt,
    message: body.message || "Prueba ficticia de conexion y prompt.",
    context: { entorno: "prueba", datos: "ficticios" },
  });
  return NextResponse.json(result);
}
