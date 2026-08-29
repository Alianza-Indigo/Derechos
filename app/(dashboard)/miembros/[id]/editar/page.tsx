import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { updateMemberAction } from "@/server/actions/platform";
import { getEditableMember, getTerritories } from "@/server/queries/app";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getEditableMember(id);
  if (!member) notFound();
  const territories = await getTerritories();

  return (
    <Card>
      <CardHeader title={`Editar ${member.fullName}`} description="Actualiza datos del miembro y su estado." />
      <ResourceForm
        submitLabel="Guardar cambios"
        action={updateMemberAction}
        fields={[
          { name: "id", type: "hidden", defaultValue: member.id },
          { name: "fullName", label: "Nombre completo", required: true, defaultValue: member.fullName },
          { name: "birthDate", label: "Fecha de nacimiento", type: "date", required: true, defaultValue: member.birthDate?.slice(0, 10) },
          { name: "gender", label: "Genero", required: true, defaultValue: member.gender },
          { name: "phone", label: "Telefono", required: true, defaultValue: member.phone },
          { name: "email", label: "Correo", type: "email", required: true, defaultValue: member.email },
          { name: "address", label: "Domicilio", type: "textarea", required: true, defaultValue: member.address },
          { name: "territoryId", label: "Territorio", type: "select", required: true, defaultValue: member.territoryId, options: territories.map((territory) => ({ value: territory.id, label: territory.name })) },
          { name: "status", label: "Estado", type: "select", defaultValue: member.status, options: ["pendiente", "activo", "suspendido", "baja", "fallecido"].map((value) => ({ value, label: value })) },
        ]}
      />
    </Card>
  );
}
