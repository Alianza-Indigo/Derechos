import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, EmptyState } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getMyReports } from "@/server/queries/app";

export const dynamic = "force-dynamic";

export default async function MyReportsPage() {
  const reports = await getMyReports();
  return (
    <Card>
      <CardHeader title="Mis reportes" description="Estado y avance de los reportes que has levantado." action={<LinkButton href="/portal/reporte">Nuevo reporte</LinkButton>} />
      {reports.length ? (
        <DataTable headers={["Folio", "Motivo", "Categoria", "Estado", "Fecha"]}>
          {reports.map((report) => (
            <tr key={report.id}>
              <td className="px-4 py-3 font-medium">{report.caseNumber}</td>
              <td className="px-4 py-3">{report.title}</td>
              <td className="px-4 py-3">{report.category}</td>
              <td className="px-4 py-3"><Badge tone={report.status === "Resuelto" ? "green" : report.status === "Nuevo" ? "amber" : "blue"}>{report.status}</Badge></td>
              <td className="px-4 py-3">{formatDate(report.openedAt)}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyState title="Sin reportes" description="Aun no has levantado ningun reporte. Usa 'Nuevo reporte' para empezar." />
      )}
    </Card>
  );
}
