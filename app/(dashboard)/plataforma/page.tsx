import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { CreateOrganizationForm, OrganizationsTable } from "@/components/platform/org-admin";
import { getPlatformStats, listOrganizations } from "@/server/queries/platform";
import { normalizeSearch } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [organizations, stats] = await Promise.all([listOrganizations(), getPlatformStats()]);
  const rootDomain = process.env.ROOT_DOMAIN?.trim().toLowerCase() || undefined;

  const query = normalizeSearch(q ?? "");
  const filtered = query
    ? organizations.filter((org) => normalizeSearch(`${org.name} ${org.slug} ${org.code} ${org.customDomain ?? ""}`).includes(query))
    : organizations;
  const pending = filtered.filter((org) => org.status === "pending");
  const rest = filtered.filter((org) => org.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Plataforma" description="Panorama y administracion de todas las organizaciones (inquilinos)." />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Organizaciones" value={stats.orgs.total} />
          <Stat label="Activas" value={stats.orgs.active} tone="text-emerald-700" />
          <Stat label="Pendientes" value={stats.orgs.pending} tone="text-amber-700" />
          <Stat label="Suspendidas" value={stats.orgs.suspended} tone="text-rose-700" />
          <Stat label="Usuarios (total)" value={stats.totals.users} />
          <Stat label="Miembros (total)" value={stats.totals.members} />
          <Stat label="Casos (total)" value={stats.totals.cases} />
          <Stat label="Planes de pago (pro+inst.)" value={stats.byPlan.pro + stats.byPlan.institucional} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Nueva organizacion" description="Alta manual de un inquilino y su primer administrador." />
        <CreateOrganizationForm />
      </Card>

      {pending.length ? (
        <Card>
          <CardHeader title={`Pendientes de aprobacion (${pending.length})`} description="Organizaciones registradas que esperan activacion." />
          <OrganizationsTable organizations={pending} rootDomain={rootDomain} />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Organizaciones registradas" description="Abre una organizacion para ver su ficha completa y administrarla." />
        <form className="px-4 pb-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre, slug, codigo o dominio..."
            className="h-10 w-full max-w-md rounded-md border border-slate-300 px-3 text-sm"
          />
        </form>
        {rest.length ? (
          <OrganizationsTable organizations={rest} rootDomain={rootDomain} />
        ) : (
          <EmptyState title="Sin organizaciones" description={query ? "Ninguna coincide con la busqueda." : "Crea la primera organizacion para comenzar."} />
        )}
      </Card>
    </div>
  );
}
