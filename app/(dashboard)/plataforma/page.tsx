import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { CreateOrganizationForm, OrganizationsTable } from "@/components/platform/org-admin";
import { listOrganizations } from "@/server/queries/platform";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  // listOrganizations exige ser la duena de la plataforma (redirige si no).
  const organizations = await listOrganizations();
  const rootDomain = process.env.ROOT_DOMAIN?.trim().toLowerCase() || undefined;
  const pending = organizations.filter((org) => org.status === "pending");
  const rest = organizations.filter((org) => org.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Plataforma · Organizaciones"
          description="Alta y administracion de inquilinos (organizaciones). Cada organizacion aisla por completo sus datos: miembros, casos, usuarios y configuracion. El plan define sus cupos; el dominio propio y el subdominio le dan acceso con su marca."
        />
        <CreateOrganizationForm />
      </Card>

      {pending.length ? (
        <Card>
          <CardHeader title={`Pendientes de aprobacion (${pending.length})`} description="Organizaciones que se registraron y esperan activacion. Aprobar habilita el acceso de sus usuarios." />
          <OrganizationsTable organizations={pending} rootDomain={rootDomain} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Organizaciones registradas" description="Estado, plan, identificadores y volumen de datos por inquilino." />
        {rest.length ? (
          <OrganizationsTable organizations={rest} rootDomain={rootDomain} />
        ) : (
          <EmptyState title="Sin organizaciones" description="Crea la primera organizacion para comenzar." />
        )}
      </Card>
    </div>
  );
}
