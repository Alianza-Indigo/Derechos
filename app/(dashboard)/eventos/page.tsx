import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getTerritoryName, listEvents } from "@/server/queries/app";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const records = await listEvents(q);
  return (
    <Card>
      <CardHeader title="Eventos realizados" description="Calendario historico, galeria, asistentes, evidencias y resultados." action={<LinkButton href="/eventos/nuevo">Nuevo evento</LinkButton>} />
      <form className="mb-4 flex gap-3">
        <input name="q" defaultValue={q} placeholder="Buscar evento..." className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
        <button className="h-10 rounded-md border border-slate-200 px-4 text-sm">Filtrar</button>
      </form>
      <DataTable headers={["Evento", "Tipo", "Fecha", "Ubicacion", "Territorio", "Asistentes"]}>
        {records.map((event) => (
          <tr key={event.id}>
            <td className="px-4 py-3 font-medium"><Link href={`/eventos/${event.id}`}>{event.title}</Link></td>
            <td className="px-4 py-3">{event.eventType}</td>
            <td className="px-4 py-3">{formatDate(event.dateStart)}</td>
            <td className="px-4 py-3">{event.location}</td>
            <td className="px-4 py-3">{getTerritoryName(event.territoryId)}</td>
            <td className="px-4 py-3">{event.attendeesCount}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
