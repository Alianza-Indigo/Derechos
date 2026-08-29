import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { ProviderEditor } from "@/components/config/provider-editor";
import { getAssistantData, getCurrentUser, getUserName } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

export default async function ProvidersPage() {
  const data = await getAssistantData();
  const user = await getCurrentUser();
  const canConfig = hasAnyPermission(user, ["ai:admin", "write:config", "*"]);

  return (
    <Card>
      <CardHeader title="Proveedores IA" description="Gemini, ChatGPT/OpenAI y Claude/Anthropic. Las API keys se guardan cifradas fuera de la vista." />
      {canConfig ? (
        <ProviderEditor providers={data.providerConfigs} />
      ) : (
        <DataTable headers={["Proveedor", "Estado", "Modelo default", "Prioridad", "Actualizado por"]}>
          {data.providerConfigs.map((provider) => (
            <tr key={provider.id}>
              <td className="px-4 py-3 font-medium">{provider.displayName}</td>
              <td className="px-4 py-3"><Badge tone={provider.enabled ? "green" : "amber"}>{provider.enabled ? "configurado" : "sin credenciales"}</Badge></td>
              <td className="px-4 py-3">{provider.defaultModel}</td>
              <td className="px-4 py-3">{provider.priority}</td>
              <td className="px-4 py-3">{getUserName(provider.updatedBy)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}
