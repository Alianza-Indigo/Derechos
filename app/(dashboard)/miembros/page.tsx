import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { listMembers, getTerritoryName } from "@/server/queries/app";
import { formatDate } from "@/lib/utils";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const records = await listMembers(q);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Directorio de miembros" description="Busqueda por nombre, numero, ciudad, estado, estatus o fecha." action={<LinkButton href="/miembros/nuevo">Nuevo miembro</LinkButton>} />
        <form className="mb-4 flex gap-3">
          <input name="q" defaultValue={q} placeholder="Buscar miembro..." className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
          <button className="h-10 rounded-md border border-slate-200 px-4 text-sm">Filtrar</button>
        </form>
        <DataTable headers={["Numero", "Nombre", "Territorio", "Estado", "Ingreso", "Credencial"]}>
          {records.map((member) => (
            <tr key={member.id}>
              <td className="px-4 py-3 font-medium"><Link href={`/miembros/${member.id}`}>{member.memberNumber}</Link></td>
              <td className="px-4 py-3">{member.fullName}</td>
              <td className="px-4 py-3">{getTerritoryName(member.territoryId)}</td>
              <td className="px-4 py-3"><Badge tone={member.status === "activo" ? "green" : "amber"}>{member.status}</Badge></td>
              <td className="px-4 py-3">{formatDate(member.joinedAt)}</td>
              <td className="px-4 py-3"><Link className="text-teal-700 underline" href={`/credencial/${member.credentialSlug}`}>Ver QR</Link></td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
