import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { CreateOrganizationForm, OrganizationsTable } from "@/components/platform/org-admin";
import { listOrganizations } from "@/server/queries/platform";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  // listOrganizations exige ser la duena de la plataforma (redirige si no).
  const organizations = await listOrganizations();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Plataforma · Organizaciones"
          description="Alta y administracion de inquilinos (organizaciones). Cada organizacion aisla por completo sus datos: miembros, casos, usuarios y configuracion."
        />
        <CreateOrganizationForm />
      </Card>
      <Card>
        <CardHeader title="Organizaciones registradas" description="Estado, identificadores y volumen de datos por inquilino." />
        {organizations.length ? (
          <OrganizationsTable organizations={organizations} />
        ) : (
          <EmptyState title="Sin organizaciones" description="Crea la primera organizacion para comenzar." />
        )}
      </Card>
    </div>
  );
}
