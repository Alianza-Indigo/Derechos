"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setOwnLocationStateAction } from "@/server/actions/platform";

export function LocationPauseControl({ enabled, reason }: { enabled: boolean; reason?: string }) {
  const [state, action, pending] = useActionState(setOwnLocationStateAction, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-600">
        Estado actual: <Badge tone={enabled ? "green" : "amber"}>{enabled ? "activa" : "pausada"}</Badge>
        {!enabled && reason ? <span className="ml-2 text-xs text-slate-500">Motivo: {reason}</span> : null}
      </p>
      <input type="hidden" name="paused" value={enabled ? "true" : "false"} />
      {enabled ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Motivo de la pausa</span>
          <input name="reason" required placeholder="Ej. fuera de horario, motivo personal justificado" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
        </label>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : enabled ? "Pausar mi ubicacion" : "Reactivar mi ubicacion"}
      </Button>
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
    </form>
  );
}
