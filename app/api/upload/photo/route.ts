import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authOptions } from "@/server/auth/options";

// Subida directa del navegador a Vercel Blob (evita el limite de ~4.5 MB del
// cuerpo de las funciones serverless). Este endpoint solo genera el token de
// carga; el archivo viaja del cliente a Blob sin pasar por la funcion.
//
// La autenticacion se valida al generar el token (peticion del navegador con
// cookie). El callback de finalizacion lo invoca Blob servidor-a-servidor sin
// cookie: por eso NO se exige sesion a nivel de ruta (ni via middleware).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
          throw new Error("No autorizado.");
        }
        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic", "image/heif"],
          maximumSizeInBytes: 12 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // No-op: la asociacion con el miembro la hace la server action.
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
