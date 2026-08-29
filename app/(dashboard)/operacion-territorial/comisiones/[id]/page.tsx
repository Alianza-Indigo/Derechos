import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { getCommissionById, getTerritoryName, getUserName } from "@/server/queries/app";

export default async function CommissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const commission = await getCommissionById(id);
  if (!commission) notFound();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={commission.title} description={commission.description} />
        <div className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs text-slate-500">Tipo</p><p className="font-medium">{commission.commissionType}</p></div>
          <div><p className="text-xs text-slate-500">Asignado</p><p className="font-medium">{getUserName(commission.assignedTo)}</p></div>
          <div><p className="text-xs text-slate-500">Territorio</p><p className="font-medium">{getTerritoryName(commission.territoryId)}</p></div>
          <div><p className="text-xs text-slate-500">Estado</p><Badge tone={commission.status === "activa" ? "green" : "slate"}>{commission.status}</Badge></div>
          <div><p className="text-xs text-slate-500">Programada</p><p className="font-medium">{formatDateTime(commission.scheduledAt)}</p></div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Historial de check-ins" description="La ubicacion es dato sensible, auditable y de retencion limitada." />
        <DataTable headers={["Usuario", "Estado", "Modo", "Precision", "Fecha"]}>
          {commission.checkIns.map((ping) => (
            <tr key={ping.id}>
              <td className="px-4 py-3">{getUserName(ping.userId)}</td>
              <td className="px-4 py-3">{ping.status}</td>
              <td className="px-4 py-3">{ping.captureMode}</td>
              <td className="px-4 py-3">{ping.accuracyMeters}m</td>
              <td className="px-4 py-3">{formatDateTime(ping.capturedAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
