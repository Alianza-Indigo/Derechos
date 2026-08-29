import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { members } from "@/drizzle/schema";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

// Proxy publico de la fotografia del miembro. La foto es un dato publico (se
// muestra en la credencial de verificacion), pero el blob vive en un store
// privado, asi que aqui se transmite su contenido con el token del store.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [member] = await db.select({ photoUrl: members.photoUrl }).from(members).where(eq(members.id, id)).limit(1);
  if (!member?.photoUrl) {
    return NextResponse.json({ error: "Sin fotografia." }, { status: 404 });
  }
  try {
    const result = await get(member.photoUrl, { access: "private" });
    if (!result) {
      return NextResponse.json({ error: "No encontrada." }, { status: 404 });
    }
    return new Response(result.stream, {
      headers: {
        "content-type": result.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la fotografia." }, { status: 502 });
  }
}
