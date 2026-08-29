import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limit = await rateLimit(clientKey(request, "upload"), 20, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiadas cargas. Intenta nuevamente en un momento." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const entityType = String(formData.get("entityType") ?? "evidence");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      url: `vercel-blob://pendiente/${entityType}/${file.name}`,
      pathname: file.name,
      message: "Carga simulada: configura BLOB_READ_WRITE_TOKEN para Vercel Blob.",
    });
  }

  const blob = await put(`${entityType}/${crypto.randomUUID()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({
    url: blob.url,
    pathname: blob.pathname,
  });
}
