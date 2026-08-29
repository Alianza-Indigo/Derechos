import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { getAssistantData, getUserName } from "@/server/queries/app";

export default async function AiHistoryPage() {
  const data = await getAssistantData();
  return (
    <Card>
      <CardHeader title="Historial de conversaciones IA" description="Relacionado por usuario, caso, evento o comision segun permisos." />
      <DataTable headers={["Titulo", "Usuario", "Entidad", "Estado", "Fecha", "Mensajes"]}>
        {data.conversations.map((conversation) => (
          <tr key={conversation.id}>
            <td className="px-4 py-3 font-medium">{conversation.title}</td>
            <td className="px-4 py-3">{getUserName(conversation.userId)}</td>
            <td className="px-4 py-3">{conversation.relatedCaseId ?? conversation.relatedEventId ?? conversation.fieldCommissionId ?? "general"}</td>
            <td className="px-4 py-3">{conversation.status}</td>
            <td className="px-4 py-3">{formatDateTime(conversation.createdAt)}</td>
            <td className="px-4 py-3">{conversation.messages.length}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
