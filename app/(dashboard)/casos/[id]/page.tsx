import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { CaseActionForm, CasePersonForm, CaseReassignForm, CaseStatusForm, EvidenceForm } from "@/components/forms/quick-actions";
import { AssistantConsole } from "@/components/assistant/assistant-console";
import { caseStatuses } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getAssistantData, getCaseById, getCurrentUser, getTerritoryName, getUserName, getUsers } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getCaseById(id);
  if (!record) notFound();
  const user = await getCurrentUser();
  const canWrite = hasAnyPermission(user, ["write:case", "write:territory", "*"]);
  const canUseAi = hasAnyPermission(user, ["ai:use", "ai:admin", "*"]);
  const prompts = canUseAi ? (await getAssistantData()).prompts : [];
  const staff = canWrite ? (await getUsers()).map((item) => ({ id: item.id, name: item.name })) : [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={record.caseNumber} description={record.title} action={<LinkButton href={`/api/export/cases?format=pdf`}>Exportar PDF</LinkButton>} />
        <div className="grid gap-4 md:grid-cols-4">
          <div><p className="text-xs text-slate-500">Categoria</p><p className="font-medium">{record.category}</p></div>
          <div><p className="text-xs text-slate-500">Prioridad</p><Badge tone={record.priority === "Urgente" ? "red" : "amber"}>{record.priority}</Badge></div>
          <div><p className="text-xs text-slate-500">Estado</p><p className="font-medium">{record.status}</p></div>
          <div><p className="text-xs text-slate-500">Territorio</p><p className="font-medium">{getTerritoryName(record.territoryId)}</p></div>
          <div><p className="text-xs text-slate-500">Responsable</p><p className="font-medium">{getUserName(record.assignedTo)}</p></div>
          <div><p className="text-xs text-slate-500">Apertura</p><p className="font-medium">{formatDate(record.openedAt)}</p></div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-700">{record.description}</p>
      </Card>
      <Card>
        <CardHeader title="Cambio de estado" description="El motivo es obligatorio y queda en historial/auditoria." />
        <CaseStatusForm caseId={record.id} statuses={caseStatuses} />
        {canWrite ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Responsable</p>
            <CaseReassignForm caseId={record.id} assignedTo={record.assignedTo} users={staff} />
          </div>
        ) : null}
      </Card>
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Personas involucradas y consentimiento" />
          <DataTable headers={["Tipo", "Nombre", "Contacto", "Consentimiento"]}>
            {record.persons.map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-3">{person.personType}</td>
                <td className="px-4 py-3">{person.name}</td>
                <td className="px-4 py-3">{person.contact}</td>
                <td className="px-4 py-3">{person.consentStatus}</td>
              </tr>
            ))}
          </DataTable>
          {canWrite ? <div className="mt-4 border-t border-slate-100 pt-4"><CasePersonForm caseId={record.id} /></div> : null}
        </Card>
        <Card>
          <CardHeader title="Timeline de acciones" />
          <DataTable headers={["Accion", "Descripcion", "Compromiso", "Estado"]}>
            {record.actions.map((action) => (
              <tr key={action.id}>
                <td className="px-4 py-3">{action.actionType}</td>
                <td className="px-4 py-3">{action.description}</td>
                <td className="px-4 py-3">{action.dueDate ? formatDate(action.dueDate) : "Sin fecha"}</td>
                <td className="px-4 py-3">{action.completedAt ? "Completada" : "Pendiente"}</td>
              </tr>
            ))}
          </DataTable>
          {canWrite ? <div className="mt-4 border-t border-slate-100 pt-4"><CaseActionForm caseId={record.id} /></div> : null}
        </Card>
      </section>
      <Card>
        <CardHeader title="Evidencia y notas internas" description="URLs protegidas mediante Vercel Blob en produccion." />
        <div className="mb-4">
          <EvidenceForm entityId={record.id} entityType="case" />
        </div>
        <DataTable headers={["Tipo", "Descripcion", "Carga"]}>
          {record.evidence.map((evidence) => (
            <tr key={evidence.id}>
              <td className="px-4 py-3">{evidence.fileType}</td>
              <td className="px-4 py-3">{evidence.description}</td>
              <td className="px-4 py-3">{formatDate(evidence.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
      {canUseAi && prompts.some((prompt) => prompt.enabled) ? (
        <Card>
          <CardHeader title="Asistente IA del caso" description="Genera borradores con el contexto de este caso (respetando tu rol y territorio)." />
          <AssistantConsole prompts={prompts} defaultCaseId={record.id} scope="caso" compact />
        </Card>
      ) : null}
    </div>
  );
}
