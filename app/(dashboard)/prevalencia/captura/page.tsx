import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPrevalenceData, getTerritories } from "@/server/queries/app";

export default async function CapturePrevalencePage() {
  const data = await getPrevalenceData();
  const territories = await getTerritories();
  return (
    <Card>
      <CardHeader title="Captura de prevalencia" description="Formulario listo para validar indicador, territorio, muestra, fuente y fecha." />
      <form className="grid gap-4 md:grid-cols-2">
        <label><span className="text-sm font-medium">Estudio</span><select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{data.studies.map((study) => <option key={study.id}>{study.name}</option>)}</select></label>
        <label><span className="text-sm font-medium">Indicador</span><select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{data.metrics.map((metric) => <option key={metric.id}>{metric.label}</option>)}</select></label>
        <label><span className="text-sm font-medium">Territorio</span><select className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{territories.map((territory) => <option key={territory.id}>{territory.name}</option>)}</select></label>
        <label><span className="text-sm font-medium">Valor numerico</span><input type="number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
        <label><span className="text-sm font-medium">Tamano de muestra</span><input type="number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
        <label><span className="text-sm font-medium">Fuente</span><input className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
        <label><span className="text-sm font-medium">Fecha de medicion</span><input type="date" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
        <div className="md:col-span-2"><Button type="button">Guardar medicion</Button></div>
      </form>
    </Card>
  );
}
