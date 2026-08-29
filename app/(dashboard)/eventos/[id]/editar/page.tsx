import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { eventTypes } from "@/lib/constants";
import { updateEventAction } from "@/server/actions/platform";
import { getEventById, getTerritories } from "@/server/queries/app";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const territories = await getTerritories();

  return (
    <Card>
      <CardHeader title={`Editar ${event.title}`} description="Actualiza la ficha del evento realizado." />
      <ResourceForm
        submitLabel="Guardar cambios"
        action={updateEventAction}
        fields={[
          { name: "id", type: "hidden", defaultValue: event.id },
          { name: "title", label: "Titulo", required: true, defaultValue: event.title },
          { name: "eventType", label: "Tipo", type: "select", defaultValue: event.eventType, options: eventTypes.map((value) => ({ value, label: value })) },
          { name: "dateStart", label: "Inicio", type: "datetime-local", required: true, defaultValue: event.dateStart.slice(0, 16) },
          { name: "dateEnd", label: "Fin", type: "datetime-local", required: true, defaultValue: event.dateEnd.slice(0, 16) },
          { name: "location", label: "Ubicacion", required: true, defaultValue: event.location },
          { name: "territoryId", label: "Territorio", type: "select", required: true, defaultValue: event.territoryId, options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "attendeesCount", label: "Asistentes", type: "number", defaultValue: event.attendeesCount },
          { name: "description", label: "Descripcion", type: "textarea", required: true, defaultValue: event.description },
          { name: "impactSummary", label: "Resumen de impacto", type: "textarea", required: true, defaultValue: event.impactSummary },
        ]}
      />
    </Card>
  );
}
