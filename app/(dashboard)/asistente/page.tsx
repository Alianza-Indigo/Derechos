import { AssistantConsole } from "@/components/assistant/assistant-console";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { getAssistantData, getOperationsData, listCases, listEvents } from "@/server/queries/app";

export default async function AssistantPage() {
  const [data, cases, events, operations] = await Promise.all([
    getAssistantData(),
    listCases(),
    listEvents(),
    getOperationsData(),
  ]);
  const caseOptions = cases.slice(0, 100).map((record) => ({ id: record.id, label: `${record.caseNumber} - ${record.title}` }));
  const eventOptions = events.slice(0, 100).map((record) => ({ id: record.id, label: record.title }));
  const commissionOptions = operations.fieldCommissions.slice(0, 100).map((record) => ({ id: record.id, label: record.title }));
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Prompts activos" value={data.prompts.filter((prompt) => prompt.enabled).length} />
        <KpiCard label="Conversaciones" value={data.conversations.length} />
        <KpiCard label="Proveedores configurados" value={data.providerConfigs.filter((provider) => provider.enabled).length} />
      </section>
      <Card>
        <CardHeader title="Asistente IA para delegados y comisionados" description="Apoyo documental, operativo y analitico con contexto permitido por rol y territorio." />
        <AssistantConsole prompts={data.prompts} cases={caseOptions} events={eventOptions} commissions={commissionOptions} />
      </Card>
    </div>
  );
}
