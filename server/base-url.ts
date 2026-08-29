import { headers } from "next/headers";
import { APP_PUBLIC_URL } from "@/lib/constants";

// Resuelve el origen publico real a partir de la peticion (host/proto), para
// que las URLs incrustadas en el QR de credencial apunten al dominio actual
// aunque APP_PUBLIC_URL no este configurada. Cae a APP_PUBLIC_URL si no hay
// contexto de peticion.
export async function resolveBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Sin contexto de peticion: usar la variable de entorno.
  }
  return APP_PUBLIC_URL;
}
