import { Card, CardHeader } from "@/components/ui/card";
import { getPrevalenceData, getTerritories } from "@/server/queries/app";
import { PrevalenceForm } from "./prevalence-form";

export default async function CapturePrevalencePage() {
  const data = await getPrevalenceData();
  const territories = await getTerritories();
  return (
    <Card>
      <CardHeader title="Captura de prevalencia" description="Valida indicador, territorio, muestra, fuente y fecha; se guarda en la base." />
      <PrevalenceForm studies={data.studies} metrics={data.metrics} territories={territories} />
    </Card>
  );
}
