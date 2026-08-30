import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, EmptyState } from "@/components/ui/table";
import { listMembers, getTerritories, getTerritoryName } from "@/server/queries/app";
import { formatDate } from "@/lib/utils";

const MEMBER_STATUSES = ["pendiente", "activo", "suspendido", "baja", "fallecido"] as const;

type MembersSearch = { q?: string; territoryId?: string; status?: string; from?: string; to?: string };

export default async function MembersPage({ searchParams }: { searchParams: Promise<MembersSearch> }) {
  const filters = await searchParams;
  const [records, territories] = await Promise.all([listMembers(filters), getTerritories()]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Directorio de miembros" description="Filtra por nombre, numero, territorio, estatus o rango de ingreso." action={<LinkButton href="/miembros/nuevo">Nuevo miembro</LinkButton>} />
        <form className="mb-4 grid gap-3 md:grid-cols-6">
          <input name="q" defaultValue={filters.q} placeholder="Nombre, numero o correo" className="h-10 rounded-md border border-slate-300 px-3 text-sm md:col-span-2" />
          <select name="territoryId" defaultValue={filters.territoryId ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Todo territorio</option>
            {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
          </select>
          <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Todo estatus</option>
            {MEMBER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input name="from" type="date" defaultValue={filters.from} className="h-10 rounded-md border border-slate-300 px-2 text-sm" title="Ingreso desde" />
          <input name="to" type="date" defaultValue={filters.to} className="h-10 rounded-md border border-slate-300 px-2 text-sm" title="Ingreso hasta" />
          <div className="flex gap-2 md:col-span-6">
            <button className="h-10 rounded-md bg-teal-700 px-4 text-sm font-medium text-white">Filtrar</button>
            <Link href="/miembros" className="flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm">Limpiar</Link>
          </div>
        </form>
        {records.length ? (
          <DataTable headers={["Numero", "Nombre", "Puesto", "Territorio", "Estado", "Ingreso", "Credencial"]}>
            {records.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 font-medium"><Link href={`/miembros/${member.id}`}>{member.memberNumber}</Link></td>
                <td className="px-4 py-3">{member.fullName}</td>
                <td className="px-4 py-3">{member.position ?? "—"}</td>
                <td className="px-4 py-3">{getTerritoryName(member.territoryId)}</td>
                <td className="px-4 py-3"><Badge tone={member.status === "activo" ? "green" : "amber"}>{member.status}</Badge></td>
                <td className="px-4 py-3">{formatDate(member.joinedAt)}</td>
                <td className="px-4 py-3"><Link className="text-teal-700 underline" href={`/credencial/${member.credentialSlug}`}>Ver QR</Link></td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState title="Sin miembros" description="No hay miembros que coincidan con los filtros seleccionados." />
        )}
      </Card>
    </div>
  );
}
