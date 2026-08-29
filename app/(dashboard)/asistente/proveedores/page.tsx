import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { getAssistantData, getUserName } from "@/server/queries/app";

export default async function ProvidersPage() {
  const data = await getAssistantData();
  return (
    <Card>
      <CardHeader title="Proveedores IA" description="Gemini, ChatGPT/OpenAI y Claude/Anthropic con credenciales protegidas por variables de entorno." />
      <DataTable headers={["Proveedor", "Estado", "Modelo default", "Referencia segura", "Prioridad", "Actualizado por"]}>
        {data.providerConfigs.map((provider) => (
          <tr key={provider.id}>
            <td className="px-4 py-3 font-medium">{provider.displayName}</td>
            <td className="px-4 py-3"><Badge tone={provider.enabled ? "green" : "amber"}>{provider.enabled ? "configurado" : "sin credenciales"}</Badge></td>
            <td className="px-4 py-3">{provider.defaultModel}</td>
            <td className="px-4 py-3">{provider.encryptedApiKeyRef.replace(/(.{4}).+/, "$1********")}</td>
            <td className="px-4 py-3">{provider.priority}</td>
            <td className="px-4 py-3">{getUserName(provider.updatedBy)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
