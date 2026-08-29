"use client";

import { useActionState } from "react";
import { runAssistantAction } from "@/server/actions/platform";
import type { AiPromptTemplate } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function AssistantConsole({ prompts }: { prompts: AiPromptTemplate[] }) {
  const [state, formAction, pending] = useActionState(runAssistantAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-slate-700">Accion del asistente</span>
          <select name="promptTemplateId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {prompts.filter((prompt) => prompt.enabled).map((prompt) => (
              <option key={prompt.id} value={prompt.id}>{prompt.name}</option>
            ))}
          </select>
        </label>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Las respuestas son borradores revisables. No sustituyen criterio humano ni autorizacion institucional.
        </div>
      </div>
      <textarea name="message" required className="min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Pega notas de campo, contexto de caso o solicitud operativa..." />
      <Button disabled={pending}>{pending ? "Generando..." : "Generar apoyo IA"}</Button>
      {state?.message ? <p className="text-sm font-medium text-slate-700">{state.message}</p> : null}
      {state?.output ? <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-4 text-sm text-slate-50">{state.output}</pre> : null}
    </form>
  );
}
