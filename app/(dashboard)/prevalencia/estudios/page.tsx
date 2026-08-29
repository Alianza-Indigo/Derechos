import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { ResourceForm } from "@/components/forms/resource-form";
import { createMetricAction, createStudyAction } from "@/server/actions/platform";
import { formatDate } from "@/lib/utils";
import { getCurrentUser, getPrevalenceData } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

export default async function StudiesPage() {
  const data = await getPrevalenceData();
  const user = await getCurrentUser();
  const canManage = hasAnyPermission(user, ["write:territory", "write:config", "*"]);

  return (
    <div className="space-y-6">
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

      {canManage ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Nuevo estudio" />
            <ResourceForm
              submitLabel="Crear estudio"
              action={createStudyAction}
              fields={[
                { name: "name", label: "Nombre", required: true },
                { name: "status", label: "Estado", type: "select", options: ["activo", "borrador", "cerrado"].map((v) => ({ value: v, label: v })) },
                { name: "startDate", label: "Inicio", type: "date", required: true },
                { name: "endDate", label: "Fin", type: "date", required: true },
                { name: "methodology", label: "Metodologia", type: "textarea", required: true },
                { name: "description", label: "Descripcion", type: "textarea", required: true },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Nuevo indicador" />
            <ResourceForm
              submitLabel="Crear indicador"
              action={createMetricAction}
              fields={[
                { name: "studyId", label: "Estudio", type: "select", required: true, options: data.studies.map((s) => ({ value: s.id, label: s.name })) },
                { name: "indicatorKey", label: "Clave (minusculas_y_guion)", required: true },
                { name: "label", label: "Etiqueta", required: true },
                { name: "valueType", label: "Tipo", type: "select", options: ["numerico", "tasa", "conteo", "porcentaje", "texto"].map((v) => ({ value: v, label: v })) },
                { name: "description", label: "Descripcion", type: "textarea", required: true },
              ]}
            />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
