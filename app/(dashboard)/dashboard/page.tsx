import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarSummary, LineSummary } from "@/components/charts/dashboard-charts";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { getDashboardData, getTerritories, getTerritoryName } from "@/server/queries/app";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const territories = await getTerritories();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Dashboard ejecutivo</h2>
        <p className="mt-1 text-sm text-slate-600">Indicadores reales del seed y estructura lista para Postgres en Vercel.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Casos por estado" description="Seguimiento operativo del expediente institucional." />
          <BarSummary data={data.casesByStatus} />
        </Card>
        <Card>
          <CardHeader title="Casos por categoria" description="Lectura rapida de fenomenos recurrentes." />
          <LineSummary data={data.casesByCategory} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Mapa de presencia y operacion" description="Vista interna; la ubicacion nunca se expone en credenciales QR ni reportes publicos." />
          <LeafletMap pings={data.activeLocations} territories={territories} />
        </Card>
        <Card>
          <CardHeader title="Casos urgentes" description="Priorizados por riesgo, plazo o posible dano irreparable." />
          <div className="space-y-3">
            {data.urgentCases.map((record) => (
              <div key={record.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-950">{record.caseNumber}</p>
                  <Badge tone="red">{record.priority}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700">{record.title}</p>
                <p className="mt-1 text-xs text-slate-500">{getTerritoryName(record.territoryId)} · {formatDate(record.openedAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Acciones vencidas o proximas" />
          <DataTable headers={["Caso", "Accion", "Fecha", "Responsable"]}>
            {data.overdueActions.map((action) => (
              <tr key={action.id}>
                <td className="px-4 py-3 font-medium">{action.caseNumber}</td>
                <td className="px-4 py-3">{action.description}</td>
                <td className="px-4 py-3">{action.dueDate ? formatDate(action.dueDate) : "Sin fecha"}</td>
                <td className="px-4 py-3">{action.createdBy}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
        <Card>
          <CardHeader title="Actividad auditada reciente" />
          <DataTable headers={["Accion", "Entidad", "Fecha"]}>
            {data.recentAudit.map((audit) => (
              <tr key={audit.id}>
                <td className="px-4 py-3 font-medium">{audit.action}</td>
                <td className="px-4 py-3">{audit.entityType}</td>
                <td className="px-4 py-3">{formatDateTime(audit.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </section>
    </div>
  );
}
