import { AssistantConsole } from "@/components/assistant/assistant-console";
import { Card, CardHeader, KpiCard } from "@/components/ui/card";
import { getAssistantData } from "@/server/queries/app";

export default async function AssistantPage() {
  const data = await getAssistantData();
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Prompts activos" value={data.prompts.filter((prompt) => prompt.enabled).length} />
        <KpiCard label="Conversaciones" value={data.conversations.length} />
        <KpiCard label="Proveedores configurados" value={data.providerConfigs.filter((provider) => provider.enabled).length} />
      </section>
      <Card>
        <CardHeader title="Asistente IA para delegados y comisionados" description="Apoyo documental, operativo y analitico con contexto permitido por rol y territorio." />
        <AssistantConsole prompts={data.prompts} />
      </Card>
    </div>
  );
}
