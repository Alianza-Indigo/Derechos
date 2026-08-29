import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { caseCategories, caseStatuses, priorities } from "@/lib/constants";
import { createCaseAction } from "@/server/actions/platform";
import { getTerritories, getUsers } from "@/server/queries/app";

export default async function NewCasePage() {
  const territories = await getTerritories();
  const users = await getUsers();
  return (
    <Card>
      <CardHeader title="Alta de caso" description="El cambio de estado y el seguimiento quedan auditados desde el primer registro." />
      <ResourceForm
        action={createCaseAction}
        submitLabel="Crear expediente"
        fields={[
          { name: "title", label: "Titulo", required: true },
          { name: "category", label: "Categoria", type: "select", options: caseCategories.map((value) => ({ value, label: value })) },
          { name: "priority", label: "Prioridad", type: "select", options: priorities.map((value) => ({ value, label: value })) },
          { name: "status", label: "Estado inicial", type: "select", options: caseStatuses.map((value) => ({ value, label: value })) },
          { name: "territoryId", label: "Territorio", type: "select", options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "assignedTo", label: "Responsable", type: "select", options: users.map((user) => ({ value: user.id, label: user.name })) },
          { name: "consentStatus", label: "Consentimiento", type: "select", options: ["documentado", "pendiente", "no_aplica"].map((value) => ({ value, label: value })) },
          { name: "description", label: "Descripcion", type: "textarea", required: true },
        ]}
      />
    </Card>
  );
}
