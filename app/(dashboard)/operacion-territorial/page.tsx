import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { getOperationsData, getTerritoryName, getUserName } from "@/server/queries/app";

export default async function TerritorialOperationPage() {
  const data = await getOperationsData();
  const active = data.pings.filter((ping) => ping.status === "en_comision").length;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Delegados/comisionados" value={data.people.length} />
        <KpiCard label="Comisiones activas" value={data.fieldCommissions.filter((item) => item.status === "activa").length} />
        <KpiCard label="Check-ins registrados" value={data.pings.length} />
        <KpiCard label="En campo" value={active} />
      </section>
      <Card>
        <CardHeader
          title="Operacion territorial"
          description="Coordinacion de delegados, comisionados, comisiones y check-ins autorizados."
          action={<div className="flex gap-2"><LinkButton href="/operacion-territorial/geolocalizacion" variant="secondary">Mapa interno</LinkButton><LinkButton href="/operacion-territorial/comisiones/nueva">Nueva comision</LinkButton></div>}
        />
        <DataTable headers={["Comision", "Asignado", "Territorio", "Estado", "Programada", "Check-ins"]}>
          {data.fieldCommissions.map((commission) => (
            <tr key={commission.id}>
              <td className="px-4 py-3 font-medium"><Link href={`/operacion-territorial/comisiones/${commission.id}`}>{commission.title}</Link></td>
              <td className="px-4 py-3">{getUserName(commission.assignedTo)}</td>
              <td className="px-4 py-3">{getTerritoryName(commission.territoryId)}</td>
              <td className="px-4 py-3"><Badge tone={commission.status === "activa" ? "green" : commission.status === "pausada" ? "amber" : "slate"}>{commission.status}</Badge></td>
              <td className="px-4 py-3">{formatDateTime(commission.scheduledAt)}</td>
              <td className="px-4 py-3">{commission.checkIns.length}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
