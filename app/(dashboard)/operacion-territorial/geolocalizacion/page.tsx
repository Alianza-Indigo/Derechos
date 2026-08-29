import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { createCheckInAction } from "@/server/actions/platform";
import { getOperationsData, getTerritories, getTerritoryName, getUserName } from "@/server/queries/app";
import { formatDateTime } from "@/lib/utils";
import { CheckInForm } from "./check-in-form";

export default async function GeolocationPage() {
  const data = await getOperationsData();
  const territories = await getTerritories();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Mapa interno de ubicaciones autorizadas" description="Auditable, sensible y nunca publico. Retencion configurable: 7, 30, 60 o 90 dias." />
        <LeafletMap pings={data.pings} territories={territories} />
      </Card>
      <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <Card>
          <CardHeader title="Check-in manual" description="Usa Browser Geolocation API desde web/PWA." />
          <CheckInForm action={createCheckInAction} territories={territories} commissions={data.fieldCommissions} />
        </Card>
        <Card>
          <CardHeader title="Ultimas ubicaciones" />
          <DataTable headers={["Usuario", "Territorio", "Estado", "Precision", "Fecha"]}>
            {data.pings.map((ping) => (
              <tr key={ping.id}>
                <td className="px-4 py-3">{getUserName(ping.userId)}</td>
                <td className="px-4 py-3">{getTerritoryName(ping.territoryId)}</td>
                <td className="px-4 py-3"><Badge tone={ping.status === "en_comision" ? "green" : ping.status === "pausado" ? "amber" : "slate"}>{ping.status}</Badge></td>
                <td className="px-4 py-3">{ping.accuracyMeters} m</td>
                <td className="px-4 py-3">{formatDateTime(ping.capturedAt)}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </section>
    </div>
  );
}
