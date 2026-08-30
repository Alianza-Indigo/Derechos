import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/options";
import { getPublicSiteFromHeaders } from "@/server/queries/tenant";
import { TenantLanding } from "@/components/public/tenant-landing";
import { PlatformLanding } from "@/components/public/platform-landing";

// La raiz es el sitio publico: depende del host y de la sesion, nunca estatica.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Un usuario autenticado que entra a la raiz va directo a su espacio operativo
  // (el layout del panel reencamina a los miembros hacia /portal).
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  // Sitio publico del inquilino resuelto por el host (subdominio o dominio
  // propio). Sin inquilino => landing de la plataforma.
  const site = await getPublicSiteFromHeaders();
  if (site) {
    return <TenantLanding site={site} />;
  }
  return <PlatformLanding />;
}
