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
  if (!hasAnyPermission(user, ["write:case", "write:event", "write:territory", "write:field", "*"])) {
    return NextResponse.json({ error: "Sin permiso para cargar archivos." }, { status: 403 });
  }
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
