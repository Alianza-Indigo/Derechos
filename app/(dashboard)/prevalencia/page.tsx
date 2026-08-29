import Link from "next/link";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { DataTable, EmptyState } from "@/components/ui/table";
import { BarSummary, LineSummary } from "@/components/charts/dashboard-charts";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { LinkButton } from "@/components/ui/button";
import { getPrevalenceData, getTerritories, getTerritoryName } from "@/server/queries/app";
import { formatDate } from "@/lib/utils";

type PrevalenceSearch = { studyId?: string; metricId?: string; territoryId?: string; from?: string; to?: string };

export default async function PrevalencePage({ searchParams }: { searchParams: Promise<PrevalenceSearch> }) {
  const filters = await searchParams;
  const data = await getPrevalenceData();
  const territories = await getTerritories();

  const records = data.records
    .filter((record) => (filters.studyId ? record.studyId === filters.studyId : true))
    .filter((record) => (filters.metricId ? record.metricId === filters.metricId : true))
    .filter((record) => (filters.territoryId ? record.territoryId === filters.territoryId : true))
    .filter((record) => (filters.from ? record.measuredAt >= filters.from : true))
    .filter((record) => (filters.to ? record.measuredAt <= `${filters.to}T23:59:59.999Z` : true));

  const valueByTerritory = new Map<string, number>();
  for (const record of records) {
    valueByTerritory.set(record.territoryId, (valueByTerritory.get(record.territoryId) ?? 0) + Number(record.valueNumeric ?? 0));
  }
  const byTerritory = territories.map((territory) => ({ territory, value: valueByTerritory.get(territory.id) ?? 0 }));
  const intensity = byTerritory
    .filter((item) => item.value > 0)
    .map((item) => ({ latitude: item.territory.latitude, longitude: item.territory.longitude, name: item.territory.name, value: item.value }));
  const cityRanking = byTerritory
    .filter((item) => item.territory.type === "city")
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ name: item.territory.name, value: Math.round(item.value) }));
  const territoryComparison = byTerritory
    .filter((item) => item.value > 0)
    .map((item) => ({ name: item.territory.name, value: Math.round(item.value) }));
  const timeSeries = Array.from(
    records.reduce((map, record) => {
      const month = record.measuredAt.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + Number(record.valueNumeric ?? 0));
      return map;
    }, new Map<string, number>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  const availableMetrics = filters.studyId ? data.metrics.filter((metric) => metric.studyId === filters.studyId) : data.metrics;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Estudios" value={data.studies.length} />
        <KpiCard label="Indicadores" value={data.metrics.length} />
        <KpiCard label="Registros" value={records.length} />
        <KpiCard label="Territorios medidos" value={new Set(records.map((record) => record.territoryId)).size} />
      </section>
      <Card>
        <CardHeader title="Filtros" description="Acota por estudio, indicador, territorio y periodo de medicion." />
        <form className="grid gap-3 md:grid-cols-6">
          <select name="studyId" defaultValue={filters.studyId ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm md:col-span-2">
            <option value="">Todo estudio</option>
            {data.studies.map((study) => <option key={study.id} value={study.id}>{study.name}</option>)}
          </select>
          <select name="metricId" defaultValue={filters.metricId ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Todo indicador</option>
            {availableMetrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
          </select>
          <select name="territoryId" defaultValue={filters.territoryId ?? ""} className="h-10 rounded-md border border-slate-300 px-2 text-sm">
            <option value="">Todo territorio</option>
            {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
          </select>
          <input name="from" type="date" defaultValue={filters.from} className="h-10 rounded-md border border-slate-300 px-2 text-sm" title="Desde" />
          <input name="to" type="date" defaultValue={filters.to} className="h-10 rounded-md border border-slate-300 px-2 text-sm" title="Hasta" />
          <div className="flex gap-2 md:col-span-6">
            <button className="h-10 rounded-md bg-teal-700 px-4 text-sm font-medium text-white">Filtrar</button>
            <Link href="/prevalencia" className="flex h-10 items-center rounded-md border border-slate-200 px-4 text-sm">Limpiar</Link>
          </div>
        </form>
      </Card>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Mapa de intensidad territorial" description="Circulo ponderado por el valor medido en pais, estado y ciudad/municipio." />
          {intensity.length ? (
            <LeafletMap pings={[]} territories={territories} intensity={intensity} />
          ) : (
            <EmptyState title="Sin datos medibles" description="No hay mediciones numericas para los filtros seleccionados." />
          )}
        </Card>
        <Card>
          <CardHeader title="Ranking de ciudades" action={<LinkButton href="/prevalencia/captura">Capturar dato</LinkButton>} />
          {cityRanking.length ? <BarSummary data={cityRanking} /> : <EmptyState title="Sin ranking" description="Captura mediciones por ciudad para ver el ranking." />}
        </Card>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Comparativo entre territorios" description="Suma de indicadores medidos por territorio." action={<LinkButton href="/prevalencia/estudios" variant="secondary">Ver estudios</LinkButton>} />
          {territoryComparison.length ? <BarSummary data={territoryComparison} /> : <EmptyState title="Sin comparativo" description="No hay valores para comparar con los filtros actuales." />}
        </Card>
        <Card>
          <CardHeader title="Serie temporal" description="Valores agregados por mes de medicion." />
          {timeSeries.length ? <LineSummary data={timeSeries} /> : <EmptyState title="Sin serie" description="No hay mediciones en el periodo seleccionado." />}
        </Card>
      </section>
      <Card>
        <CardHeader title="Registros de prevalencia" />
        {records.length ? (
          <DataTable headers={["Indicador", "Territorio", "Valor", "Muestra", "Fuente", "Fecha"]}>
            {records.slice(0, 20).map((record) => {
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
        ) : (
          <EmptyState title="Sin registros" description="No hay mediciones que coincidan con los filtros." />
        )}
      </Card>
    </div>
  );
}
