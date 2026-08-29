import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { authOptions } from "@/server/auth/options";
import { hasAnyPermission } from "@/server/permissions/rbac";
import { getCurrentUser } from "@/server/queries/app";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const user = await getCurrentUser();
  const formData = await request.formData();
  const file = formData.get("file");
  const entityType = String(formData.get("entityType") ?? "evidence");
  // Los miembros pueden subir su propia fotografia (dato publico de la
  // credencial); el resto de cargas requiere permiso de escritura.
  const isOwnPhoto = entityType === "member-photo";
  if (!isOwnPhoto && !hasAnyPermission(user, ["write:case", "write:event", "write:territory", "write:field", "*"])) {
    return NextResponse.json({ error: "Sin permiso para cargar archivos." }, { status: 403 });
  }
  const limit = await rateLimit(clientKey(request, "upload"), 20, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiadas cargas. Intenta nuevamente en un momento." }, { status: 429 });
  }

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

  // Nombre seguro: sin espacios ni caracteres especiales que puedan romper la
  // ruta del blob.
  const safeName = (file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  try {
    const blob = await put(`${entityType}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    // Devuelve el motivo real de Vercel Blob para poder diagnosticar.
    return NextResponse.json(
      { error: `Vercel Blob: ${error instanceof Error ? error.message : "error desconocido"}` },
      { status: 502 },
    );
  }
}
