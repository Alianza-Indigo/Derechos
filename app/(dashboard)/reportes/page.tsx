import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getReportDefinitions } from "@/server/queries/app";

export default async function ReportsPage() {
  const reports = await getReportDefinitions();
  return (
    <Card>
      <CardHeader title="Generador de reportes" description="Exportaciones CSV, XLSX y PDF con filtros, usuario generador y marca interna cuando aplica." />
      <DataTable headers={["Reporte", "Tipo", "Filtros", "Clasificacion", "Formatos"]}>
        {reports.map((report) => (
          <tr key={report.id}>
            <td className="px-4 py-3 font-medium">{report.title}</td>
            <td className="px-4 py-3">{report.type}</td>
            <td className="px-4 py-3">{report.filters.join(", ")}</td>
            <td className="px-4 py-3"><Badge tone={report.internal ? "amber" : "green"}>{report.internal ? "interno" : "publicable"}</Badge></td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {report.formats.map((format) => (
                  <a key={format} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-teal-700" href={`/api/export/${report.type === "urgent_cases" ? "cases" : report.type === "field_operations" ? "members" : report.type === "ai_usage" ? "members" : report.type}?format=${format.toLowerCase()}`}>
                    {format}
                  </a>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
