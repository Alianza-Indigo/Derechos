import { Card, CardHeader } from "@/components/ui/card";
import { PrevalenceCaptureForm } from "@/components/forms/quick-actions";
import { getPrevalenceData, getTerritories } from "@/server/queries/app";

export default async function CapturePrevalencePage() {
  const data = await getPrevalenceData();
  const territories = await getTerritories();
  return (
    <Card>
      <CardHeader title="Captura de prevalencia" description="Formulario listo para validar indicador, territorio, muestra, fuente y fecha." />
      <PrevalenceCaptureForm studies={data.studies} metrics={data.metrics} territories={territories} />
    </Card>
  );
}
