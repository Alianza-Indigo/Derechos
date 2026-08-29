import { notFound } from "next/navigation";
import { AssistantConsole } from "@/components/assistant/assistant-console";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { getAssistantData, getPromptById, getUserName } from "@/server/queries/app";

export default async function PromptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prompt = await getPromptById(id);
  if (!prompt) notFound();
  const data = await getAssistantData();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={prompt.name} description={prompt.description} />
        <DataTable headers={["Campo", "Valor"]}>
          <tr><td className="px-4 py-3 font-medium">Clave</td><td className="px-4 py-3">{prompt.key}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Modulo</td><td className="px-4 py-3">{prompt.moduleScope}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Proveedor</td><td className="px-4 py-3">{prompt.providerKey}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Version</td><td className="px-4 py-3">{prompt.version}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Estado</td><td className="px-4 py-3"><Badge tone={prompt.enabled ? "green" : "slate"}>{prompt.enabled ? "activo" : "inactivo"}</Badge></td></tr>
          <tr><td className="px-4 py-3 font-medium">Variables</td><td className="px-4 py-3">{prompt.variables.join(", ")}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Actualizado por</td><td className="px-4 py-3">{getUserName(prompt.updatedBy)}</td></tr>
        </DataTable>
      </Card>
      <Card>
        <CardHeader title="Probar prompt con datos ficticios" />
        <AssistantConsole prompts={[prompt, ...data.prompts.filter((item) => item.id !== prompt.id)]} />
      </Card>
    </div>
  );
}
