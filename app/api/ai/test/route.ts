import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { runAssistant } from "@/lib/ai/adapters";
import { authOptions } from "@/server/auth/options";
import { getPromptRecordById, listPrompts } from "@/server/queries/app";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const body = (await request.json()) as { promptId?: string; message?: string };
  const prompt = (body.promptId ? await getPromptRecordById(body.promptId) : undefined) ?? (await listPrompts())[0];
  if (!prompt) {
    return NextResponse.json({ error: "No hay prompts configurados." }, { status: 404 });
  }

  const result = await runAssistant({
    prompt,
    message: body.message || "Prueba ficticia de conexion y prompt.",
    context: { entorno: "prueba", datos: "ficticios" },
  });
  return NextResponse.json(result);
}
