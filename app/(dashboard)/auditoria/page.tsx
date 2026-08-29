import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { getAuditLogs, getUserName } from "@/server/queries/app";

export default async function AuditPage() {
  const logs = await getAuditLogs();
  return (
    <Card>
      <CardHeader title="Bitacora de auditoria" description="Acciones sensibles: login, miembros, credenciales, casos, evidencias, reportes, roles, geolocalizacion, comisiones, IA y proveedores." />
      <DataTable headers={["Fecha", "Actor", "Accion", "Entidad", "ID", "IP"]}>
        {logs.map((log) => (
          <tr key={log.id}>
            <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
            <td className="px-4 py-3">{getUserName(log.actorId)}</td>
            <td className="px-4 py-3 font-medium">{log.action}</td>
            <td className="px-4 py-3">{log.entityType}</td>
            <td className="px-4 py-3">{log.entityId}</td>
            <td className="px-4 py-3">{log.ip ?? "N/A"}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
