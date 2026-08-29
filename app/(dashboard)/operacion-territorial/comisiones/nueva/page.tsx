import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { createCommissionAction } from "@/server/actions/platform";
import { getTerritories, getUsers } from "@/server/queries/app";

export default async function NewCommissionPage() {
  const territories = await getTerritories();
  const users = await getUsers();
  const fieldUsers = users.filter((user) => user.roles.includes("field_commissioner") || user.roles.includes("territorial_delegate"));
  return (
    <Card>
      <CardHeader title="Alta de comision" description="Permite seguimiento, check-ins autorizados, relacion con caso/evento y auditoria." />
      <ResourceForm
        action={createCommissionAction}
        submitLabel="Crear comision"
        fields={[
          { name: "title", label: "Titulo", required: true },
          { name: "commissionType", label: "Tipo de comision", required: true },
          { name: "assignedTo", label: "Asignado a", type: "select", options: fieldUsers.map((user) => ({ value: user.id, label: user.name })) },
          { name: "territoryId", label: "Territorio", type: "select", options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "scheduledAt", label: "Fecha programada", type: "datetime-local", required: true },
          { name: "description", label: "Descripcion", type: "textarea", required: true },
        ]}
      />
    </Card>
  );
}
