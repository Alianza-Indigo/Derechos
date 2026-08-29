import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { eventTypes } from "@/lib/constants";
import { createEventAction } from "@/server/actions/platform";
import { getTerritories } from "@/server/queries/app";

export default async function NewEventPage() {
  const territories = await getTerritories();
  return (
    <Card>
      <CardHeader title="Alta de evento" description="Documenta asistentes, evidencias, resultados e indicadores impactados." />
      <ResourceForm
        action={createEventAction}
        submitLabel="Registrar evento"
        fields={[
          { name: "title", label: "Titulo", required: true },
          { name: "eventType", label: "Tipo", type: "select", options: eventTypes.map((value) => ({ value, label: value })) },
          { name: "dateStart", label: "Inicio", type: "datetime-local", required: true },
          { name: "dateEnd", label: "Fin", type: "datetime-local", required: true },
          { name: "location", label: "Ubicacion fisica o virtual", required: true },
          { name: "territoryId", label: "Territorio", type: "select", options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "attendeesCount", label: "Asistentes", type: "number", defaultValue: 0 },
          { name: "description", label: "Descripcion y objetivo", type: "textarea", required: true },
          { name: "impactSummary", label: "Resultados e impacto", type: "textarea", required: true },
        ]}
      />
    </Card>
  );
}
