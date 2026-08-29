import { put } from "@vercel/blob";

// Sube un archivo de evidencia a Vercel Blob y devuelve su URL publica.
// Requiere BLOB_READ_WRITE_TOKEN (se inyecta automaticamente en Vercel).
export async function uploadEvidenceFile(prefix: string, file: File) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Almacenamiento de archivos no configurado (define BLOB_READ_WRITE_TOKEN).");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${prefix}/${Date.now()}-${safeName}`;
  const blob = await put(key, file, { access: "public", addRandomSuffix: true });
  return { url: blob.url, contentType: file.type || "application/octet-stream" };
}
