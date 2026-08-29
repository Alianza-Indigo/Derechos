import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { formatDate } from "@/lib/utils";
import { getTerritories, getTerritoryName, listEvents } from "@/server/queries/app";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [records, territories] = await Promise.all([listEvents(q), getTerritories()]);
  const eventTerritoryIds = new Set(records.map((event) => event.territoryId));
  const eventTerritories = territories.filter((territory) => eventTerritoryIds.has(territory.id));
  const totalAttendees = records.reduce((sum, event) => sum + event.attendeesCount, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Eventos realizados"
          description={`Calendario historico, galeria, asistentes e impacto. ${records.length} eventos, ${totalAttendees} personas alcanzadas.`}
          action={<LinkButton href="/eventos/nuevo">Nuevo evento</LinkButton>}
        />
        <form className="mb-4 flex gap-3">
          <input name="q" defaultValue={q} placeholder="Buscar evento..." className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
          <button className="h-10 rounded-md border border-slate-200 px-4 text-sm">Filtrar</button>
        </form>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Mapa de eventos" description="Territorios con actividad institucional documentada." />
          <LeafletMap pings={[]} territories={eventTerritories} />
        </Card>
        <Card>
          <CardHeader title="Galeria institucional" description="Fichas de eventos listas para compartir." />
          <div className="grid gap-3 sm:grid-cols-2">
            {records.slice(0, 6).map((event) => (
              <Link key={event.id} href={`/eventos/${event.id}`} className="rounded-lg border border-slate-200 p-3 hover:border-teal-600">
                <p className="text-xs uppercase tracking-wide text-teal-700">{event.eventType}</p>
                <p className="mt-1 font-semibold text-slate-900">{event.title}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(event.dateStart)} · {getTerritoryName(event.territoryId)}</p>
                <p className="mt-1 text-xs text-slate-600">{event.attendeesCount} asistentes</p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader title="Calendario historico" />
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
    </div>
  );
}
