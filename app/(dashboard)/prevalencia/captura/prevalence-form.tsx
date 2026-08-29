"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createPrevalenceRecordAction } from "@/server/actions/platform";
import type { PrevalenceMetric, PrevalenceStudy, Territory } from "@/lib/types";

export function PrevalenceForm({
  studies,
  metrics,
  territories,
}: {
  studies: PrevalenceStudy[];
  metrics: PrevalenceMetric[];
  territories: Territory[];
}) {
  const [state, formAction, pending] = useActionState(createPrevalenceRecordAction, null);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <label>
        <span className="text-sm font-medium">Estudio</span>
        <select name="studyId" required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          {studies.map((study) => (
            <option key={study.id} value={study.id}>{study.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-sm font-medium">Indicador</span>
        <select name="metricId" required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          {metrics.map((metric) => (
            <option key={metric.id} value={metric.id}>{metric.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-sm font-medium">Territorio</span>
        <select name="territoryId" required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          {territories.map((territory) => (
            <option key={territory.id} value={territory.id}>{territory.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-sm font-medium">Valor numerico</span>
        <input name="valueNumeric" type="number" step="0.01" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium">Tamano de muestra</span>
        <input name="sampleSize" type="number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium">Fuente</span>
        <input name="source" required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium">Fecha de medicion</span>
        <input name="measuredAt" type="date" required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <div className="md:col-span-2 space-y-2">
        {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar medicion"}</Button>
      </div>
    </form>
  );
}
