"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { caseCategories } from "@/lib/constants";
import { submitPublicReportAction } from "@/server/actions/public";

const inputCls = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
const areaCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export function PublicReportForm() {
  const [state, action, pending] = useActionState(submitPublicReportAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{state.message}</p>
        <Link href="/" className="text-sm text-[var(--brand,#0f766e)] underline">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="text-sm font-medium text-slate-700">Asunto</span>
        <input name="title" required className={inputCls} placeholder="Resumen breve del caso" />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Categoria</span>
        <select name="category" required className={inputCls}>
          <option value="">Selecciona...</option>
          {caseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Descripcion de los hechos</span>
        <textarea name="description" required rows={5} className={areaCls} placeholder="Que ocurrio, cuando, quienes intervinieron..." />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-slate-700">Fecha del incidente</span>
          <input name="incidentDate" type="date" className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Lugar del incidente</span>
          <input name="incidentLocation" className={inputCls} placeholder="Ciudad, colonia, institucion..." />
        </label>
      </div>
      <label className="block"><span className="text-sm font-medium text-slate-700">Derecho vulnerado (opcional)</span>
        <input name="rightViolated" className={inputCls} />
      </label>

      <div className="rounded-md border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="anonymous" className="size-4" /> Enviar de forma anonima
        </label>
        <p className="mt-1 text-xs text-slate-500">Si marcas anonimo, no se guardara tu nombre ni contacto.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-700">Tu nombre (opcional)</span>
            <input name="reporterName" className={inputCls} />
          </label>
          <label className="block"><span className="text-sm font-medium text-slate-700">Tu contacto (opcional)</span>
            <input name="reporterContact" className={inputCls} placeholder="Correo o telefono" />
          </label>
          <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700">Persona afectada, si es distinta (opcional)</span>
            <input name="affectedName" className={inputCls} />
          </label>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="consent" className="mt-0.5 size-4" />
        <span>Acepto que mis datos se traten para dar seguimiento a este reporte, conforme al aviso de privacidad de la organizacion.</span>
      </label>

      {state && !state.ok ? <p className="text-sm text-rose-700">{state.message}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando..." : "Enviar reporte"}</Button>
    </form>
  );
}
