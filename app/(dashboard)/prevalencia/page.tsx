import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { BarSummary, LineSummary } from "@/components/charts/dashboard-charts";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { LinkButton } from "@/components/ui/button";
import { getPrevalenceData, getTerritories, getTerritoryName } from "@/server/queries/app";
import { formatDate } from "@/lib/utils";

export default async function PrevalencePage() {
  const data = await getPrevalenceData();
  const territories = await getTerritories();
  const cityRanking = data.byTerritory
    .filter((item) => item.territory.type === "city")
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ name: item.territory.name, value: Math.round(item.value) }));
  const territoryComparison = data.byTerritory
    .filter((item) => item.value > 0)
    .map((item) => ({ name: item.territory.name, value: Math.round(item.value) }));
  const timeSeries = Array.from(
    data.records.reduce((map, record) => {
      const month = record.measuredAt.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + Number(record.valueNumeric ?? 0));
      return map;
    }, new Map<string, number>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value: Math.round(value) }));
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Estudios" value={data.studies.length} />
        <KpiCard label="Indicadores" value={data.metrics.length} />
        <KpiCard label="Registros" value={data.records.length} />
        <KpiCard label="Territorios medidos" value={new Set(data.records.map((record) => record.territoryId)).size} />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Mapa de intensidad territorial" description="Pais, estado y ciudad/municipio con datos medibles." />
          <LeafletMap pings={[]} territories={territories} />
        </Card>
        <Card>
          <CardHeader title="Ranking de ciudades" action={<LinkButton href="/prevalencia/captura">Capturar dato</LinkButton>} />
          <BarSummary data={cityRanking} />
        </Card>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Comparativo entre territorios" description="Suma de indicadores medidos por territorio." action={<LinkButton href="/prevalencia/estudios" variant="secondary">Ver estudios</LinkButton>} />
          <BarSummary data={territoryComparison} />
        </Card>
        <Card>
          <CardHeader title="Serie temporal" description="Valores agregados por mes de medicion." />
          <LineSummary data={timeSeries} />
        </Card>
      </section>
      <Card>
        <CardHeader title="Registros de prevalencia" />
        <DataTable headers={["Indicador", "Territorio", "Valor", "Muestra", "Fuente", "Fecha"]}>
          {data.records.slice(0, 20).map((record) => {
            const metric = data.metrics.find((item) => item.id === record.metricId);
            return (
              <tr key={record.id}>
                <td className="px-4 py-3 font-medium">{metric?.label}</td>
                <td className="px-4 py-3">{getTerritoryName(record.territoryId)}</td>
                <td className="px-4 py-3">{record.valueNumeric ?? record.valueText}</td>
                <td className="px-4 py-3">{record.sampleSize ?? "N/A"}</td>
                <td className="px-4 py-3">{record.source}</td>
                <td className="px-4 py-3">{formatDate(record.measuredAt)}</td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}
