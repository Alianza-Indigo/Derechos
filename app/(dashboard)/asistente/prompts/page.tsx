import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { DuplicatePromptButton } from "@/components/forms/quick-actions";
import { getAssistantData, getUserName } from "@/server/queries/app";

export default async function PromptsPage() {
  const data = await getAssistantData();
  return (
    <Card>
      <CardHeader title="Biblioteca de prompts IA" description="Editables, duplicables, activables/desactivables y versionados sin despliegue." action={<LinkButton href="/asistente/prompts/nuevo">Nuevo prompt</LinkButton>} />
      <DataTable headers={["Nombre", "Modulo", "Proveedor", "Modelo", "Version", "Estado", "Actualizado por", "Acciones"]}>
        {data.prompts.map((prompt) => (
          <tr key={prompt.id}>
            <td className="px-4 py-3 font-medium"><Link href={`/asistente/prompts/${prompt.id}`}>{prompt.name}</Link></td>
            <td className="px-4 py-3">{prompt.moduleScope}</td>
            <td className="px-4 py-3">{prompt.providerKey}</td>
            <td className="px-4 py-3">{prompt.model ?? "default"}</td>
            <td className="px-4 py-3">{prompt.version}</td>
            <td className="px-4 py-3"><Badge tone={prompt.enabled ? "green" : "slate"}>{prompt.enabled ? "activo" : "inactivo"}</Badge></td>
            <td className="px-4 py-3">{getUserName(prompt.updatedBy)}</td>
            <td className="px-4 py-3"><DuplicatePromptButton promptId={prompt.id} /></td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
