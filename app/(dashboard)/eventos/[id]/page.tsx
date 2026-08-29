import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { EvidenceForm } from "@/components/forms/quick-actions";
import { formatDate } from "@/lib/utils";
import { getEventById, getTerritoryName, getUserName } from "@/server/queries/app";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={event.title} description={event.description} action={<LinkButton href="/api/export/events?format=pdf">Ficha PDF</LinkButton>} />
        <div className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs text-slate-500">Tipo</p><p className="font-medium">{event.eventType}</p></div>
          <div><p className="text-xs text-slate-500">Fecha</p><p className="font-medium">{formatDate(event.dateStart)}</p></div>
          <div><p className="text-xs text-slate-500">Territorio</p><p className="font-medium">{getTerritoryName(event.territoryId)}</p></div>
          <div><p className="text-xs text-slate-500">Organizador</p><p className="font-medium">{getUserName(event.organizerId)}</p></div>
          <div><p className="text-xs text-slate-500">Asistentes</p><p className="font-medium">{event.attendeesCount}</p></div>
          <div><p className="text-xs text-slate-500">Ubicacion</p><p className="font-medium">{event.location}</p></div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Resultados, aliados e indicadores" />
        <div className="mb-4">
          <EvidenceForm entityId={event.id} entityType="event" />
        </div>
        <DataTable headers={["Seccion", "Contenido"]}>
          <tr><td className="px-4 py-3 font-medium">Impacto</td><td className="px-4 py-3">{event.impactSummary}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Instituciones</td><td className="px-4 py-3">{event.institutions.join(", ")}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Indicadores</td><td className="px-4 py-3">{event.indicators.join(", ")}</td></tr>
        </DataTable>
      </Card>
    </div>
  );
}
