"use client";

import { useActionState } from "react";
import { runAssistantAction, submitAiFeedbackAction } from "@/server/actions/platform";
import type { AiPromptTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Option = { id: string; label: string };

export function AssistantConsole({
  prompts,
  cases = [],
  events = [],
  commissions = [],
  defaultCaseId,
  defaultEventId,
  defaultCommissionId,
  scope,
  compact,
}: {
  prompts: AiPromptTemplate[];
  cases?: Option[];
  events?: Option[];
  commissions?: Option[];
  defaultCaseId?: string;
  defaultEventId?: string;
  defaultCommissionId?: string;
  scope?: AiPromptTemplate["moduleScope"];
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(runAssistantAction, null);
  const usablePrompts = prompts
    .filter((prompt) => prompt.enabled)
    .filter((prompt) => (scope ? prompt.moduleScope === scope || prompt.moduleScope === "general" : true));

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
          <label>
            <span className="text-sm font-medium text-slate-700">Accion del asistente</span>
            <select name="promptTemplateId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
              {usablePrompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
              ))}
            </select>
          </label>
          {!compact ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Las respuestas son borradores revisables. No sustituyen criterio humano ni autorizacion institucional.
            </div>
          ) : null}
        </div>

        {(cases.length || events.length || commissions.length || defaultCaseId || defaultEventId || defaultCommissionId) ? (
          <div className="grid gap-3 md:grid-cols-3">
            {defaultCaseId ? (
              <input type="hidden" name="relatedCaseId" value={defaultCaseId} />
            ) : cases.length ? (
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Caso relacionado</span>
                <select name="relatedCaseId" className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm">
                  <option value="">Sin caso</option>
                  {cases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select></label>
            ) : null}
            {defaultEventId ? (
              <input type="hidden" name="relatedEventId" value={defaultEventId} />
            ) : events.length ? (
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Evento relacionado</span>
                <select name="relatedEventId" className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm">
                  <option value="">Sin evento</option>
                  {events.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select></label>
            ) : null}
            {defaultCommissionId ? (
              <input type="hidden" name="fieldCommissionId" value={defaultCommissionId} />
            ) : commissions.length ? (
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Comision relacionada</span>
                <select name="fieldCommissionId" className="h-10 w-full rounded-md border border-slate-300 px-2 text-sm">
                  <option value="">Sin comision</option>
                  {commissions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select></label>
            ) : null}
          </div>
        ) : null}

        <textarea name="message" required className="min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Pega notas de campo, contexto de caso o solicitud operativa..." />
        <Button disabled={pending}>{pending ? "Generando..." : "Generar apoyo IA"}</Button>
        {state?.message ? <p className={state.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-rose-700"}>{state.message}</p> : null}
        {state?.output ? <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-4 text-sm text-slate-50">{state.output}</pre> : null}
      </form>
      {state?.ok && state.runId ? <FeedbackForm runId={state.runId} /> : null}
    </div>
  );
}

function FeedbackForm({ runId }: { runId: string }) {
  const [state, action, pending] = useActionState(submitAiFeedbackAction, null);
  if (state?.ok) {
    return <p className="text-sm text-emerald-700">{state.message}</p>;
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="aiRunId" value={runId} />
      <span className="text-sm text-slate-600">Califica esta respuesta:</span>
      {[1, 2, 3, 4, 5].map((rating) => (
        <Button key={rating} type="submit" name="rating" value={rating} variant="secondary" className="h-8 w-8 px-0 text-xs" disabled={pending}>
          {rating}
        </Button>
      ))}
      <input name="comment" placeholder="Comentario (opcional)" className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-xs" />
      {state?.message ? <span className="text-xs text-rose-700">{state.message}</span> : null}
    </form>
  );
}
