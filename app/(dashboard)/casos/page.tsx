import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getTerritoryName, getUserName, listCases } from "@/server/queries/app";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const records = await listCases(q);
  return (
    <Card>
      <CardHeader title="Bandeja de casos" description="Expedientes con folio, prioridad, responsable, territorio y trazabilidad." action={<LinkButton href="/casos/nuevo">Nuevo caso</LinkButton>} />
      <form className="mb-4 flex gap-3">
        <input name="q" defaultValue={q} placeholder="Buscar por folio, categoria, estado..." className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
        <button className="h-10 rounded-md border border-slate-200 px-4 text-sm">Filtrar</button>
      </form>
      <DataTable headers={["Folio", "Titulo", "Categoria", "Prioridad", "Estado", "Territorio", "Responsable", "Apertura"]}>
        {records.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 font-medium"><Link href={`/casos/${record.id}`}>{record.caseNumber}</Link></td>
            <td className="px-4 py-3">{record.title}</td>
            <td className="px-4 py-3">{record.category}</td>
            <td className="px-4 py-3"><Badge tone={record.priority === "Urgente" ? "red" : record.priority === "Alta" ? "amber" : "slate"}>{record.priority}</Badge></td>
            <td className="px-4 py-3">{record.status}</td>
            <td className="px-4 py-3">{getTerritoryName(record.territoryId)}</td>
            <td className="px-4 py-3">{getUserName(record.assignedTo)}</td>
            <td className="px-4 py-3">{formatDate(record.openedAt)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
