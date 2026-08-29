import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getPrevalenceData } from "@/server/queries/app";

export default async function StudiesPage() {
  const data = await getPrevalenceData();
  return (
    <Card>
      <CardHeader title="Estudios de prevalencia" description="Metodologia, periodo, indicadores y estado del estudio." />
      <DataTable headers={["Nombre", "Metodologia", "Periodo", "Estado", "Indicadores"]}>
        {data.studies.map((study) => (
          <tr key={study.id}>
            <td className="px-4 py-3 font-medium">{study.name}</td>
            <td className="px-4 py-3">{study.methodology}</td>
            <td className="px-4 py-3">{formatDate(study.startDate)} - {formatDate(study.endDate)}</td>
            <td className="px-4 py-3"><Badge tone="green">{study.status}</Badge></td>
            <td className="px-4 py-3">{data.metrics.filter((metric) => metric.studyId === study.id).length}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
