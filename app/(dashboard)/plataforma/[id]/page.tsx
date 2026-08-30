import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, EmptyState } from "@/components/ui/table";
import { DomainControl, PlanControl, StatusControls } from "@/components/platform/org-admin";
import { OrganizationAdmins, OrganizationDetailsForm } from "@/components/platform/org-detail";
import { getOrganizationDetail } from "@/server/queries/platform";
import { formatDateTime } from "@/lib/utils";
import { planLabel } from "@/lib/plans";

export const dynamic = "force-dynamic";

const statusTone: Record<string, "green" | "amber" | "slate"> = { active: "green", pending: "amber", suspended: "slate" };
const statusLabel: Record<string, string> = { active: "activa", pending: "pendiente", suspended: "suspendida" };

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrganizationDetail(id);
  if (!org) {
    notFound();
  }
  const rootDomain = process.env.ROOT_DOMAIN?.trim().toLowerCase() || undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={org.name}
          description={`slug: ${org.slug} · codigo: ${org.code} · ${org.country}`}
          action={<Link href="/plataforma" className="text-sm text-teal-700 underline">Volver a plataforma</Link>}
        />
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          <Badge tone={statusTone[org.status] ?? "slate"}>{statusLabel[org.status] ?? org.status}</Badge>
          <Badge tone="slate">plan {planLabel(org.plan)}</Badge>
          {rootDomain ? <span className="text-xs text-slate-500">{org.slug}.{rootDomain}</span> : null}
          {org.customDomain ? <span className="text-xs text-slate-500">· dominio propio: {org.customDomain}</span> : null}
        </div>
        <div className="flex flex-wrap gap-4 px-4 pb-4 text-sm text-slate-600">
          <span>{org.counts.users} usuarios</span>
          <span>{org.counts.members} miembros</span>
          <span>{org.counts.cases} casos</span>
          <span>Creada: {formatDateTime(org.createdAt)}</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Administracion" description="Estado, plan y dominio del inquilino." />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <StatusControls org={org} />
          <PlanControl org={org} />
          <DomainControl org={org} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Datos de la organizacion" description="Nombre, razon social, pais base y color de marca." />
        <OrganizationDetailsForm org={org} />
      </Card>

      <Card>
        <CardHeader title="Administradores" description="Cuentas con rol super_admin. Puedes restablecer su contrasena para recuperar acceso." />
        <OrganizationAdmins orgId={org.id} admins={org.admins} />
      </Card>

      <Card>
        <CardHeader title="Actividad reciente" description="Ultimos eventos auditados de esta organizacion." />
        {org.activity.length ? (
          <DataTable headers={["Fecha", "Accion", "Entidad", "Actor"]}>
            {org.activity.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-sm">{formatDateTime(a.createdAt)}</td>
                <td className="px-4 py-3 text-sm font-medium">{a.action}</td>
                <td className="px-4 py-3 text-sm">{a.entityType}</td>
                <td className="px-4 py-3 text-sm">{a.actorName ?? "sistema"}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState title="Sin actividad" description="Aun no hay eventos auditados." />
        )}
      </Card>
    </div>
  );
}
