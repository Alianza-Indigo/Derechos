import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { createMemberAction } from "@/server/actions/platform";
import { getTerritories } from "@/server/queries/app";

export default async function NewMemberPage() {
  const territories = await getTerritories();
  return (
    <Card>
      <CardHeader title="Alta de miembro" description="Genera numero institucional y credencial QR con vista publica segura." />
      <ResourceForm
        action={createMemberAction}
        submitLabel="Registrar miembro"
        fields={[
          { name: "fullName", label: "Nombre completo", required: true },
          { name: "birthDate", label: "Fecha de nacimiento", type: "date", required: true },
          { name: "gender", label: "Genero", type: "select", options: ["No especificado", "Femenino", "Masculino", "Otro"].map((value) => ({ value, label: value })) },
          { name: "phone", label: "Telefono", required: true },
          { name: "email", label: "Correo", type: "email", required: true },
          { name: "territoryId", label: "Territorio", type: "select", options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "status", label: "Estado", type: "select", options: ["pendiente", "activo", "suspendido", "baja", "fallecido"].map((value) => ({ value, label: value })) },
          { name: "address", label: "Domicilio o referencia", type: "textarea", required: true },
        ]}
      />
    </Card>
  );
}
