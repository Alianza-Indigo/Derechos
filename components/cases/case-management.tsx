"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { caseStatuses, priorities } from "@/lib/constants";
import { addCaseActionAction, addCaseEvidenceAction, changeCaseStatusAction } from "@/server/actions/platform";

function Message({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) {
    return null;
  }
  return <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>;
}

export function CaseManagement({ caseId, status, priority }: { caseId: string; status: string; priority: string }) {
  const [statusState, statusAction, statusPending] = useActionState(changeCaseStatusAction, null);
  const [actionState, actionAction, actionPending] = useActionState(addCaseActionAction, null);
  const [evidenceState, evidenceAction, evidencePending] = useActionState(addCaseEvidenceAction, null);

  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader title="Actualizar estado" />
        <form action={statusAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Estado</span>
            <select name="status" defaultValue={status} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
              {caseStatuses.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Prioridad</span>
            <select name="priority" defaultValue={priority} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
              {priorities.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <Message state={statusState} />
          <Button type="submit" disabled={statusPending}>{statusPending ? "Guardando..." : "Actualizar"}</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Agregar accion" />
        <form action={actionAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input name="actionType" placeholder="Tipo de accion" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
          <textarea name="description" placeholder="Descripcion" required className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Fecha compromiso</span>
            <input name="dueDate" type="date" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
          </label>
          <Message state={actionState} />
          <Button type="submit" disabled={actionPending}>{actionPending ? "Guardando..." : "Agregar accion"}</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Cargar evidencia" description="Se almacena en Vercel Blob." />
        <form action={evidenceAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input name="description" placeholder="Descripcion de la evidencia" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
          <input name="file" type="file" required className="w-full text-sm" />
          <Message state={evidenceState} />
          <Button type="submit" disabled={evidencePending}>{evidencePending ? "Subiendo..." : "Cargar evidencia"}</Button>
        </form>
      </Card>
    </section>
  );
}
