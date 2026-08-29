"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { updateCommissionAction } from "@/server/actions/platform";

const STATUSES = ["programada", "activa", "pausada", "completada", "cancelada"] as const;

export function CommissionManagement({ id, status, description }: { id: string; status: string; description: string }) {
  const [state, action, pending] = useActionState(updateCommissionAction, null);
  return (
    <Card>
      <CardHeader title="Actualizar comision" />
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="id" value={id} />
        <label>
          <span className="text-sm font-medium text-slate-700">Estado</span>
          <select name="status" defaultValue={status} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {STATUSES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Descripcion / notas</span>
          <textarea name="description" defaultValue={description} required className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <div className="md:col-span-2 space-y-2">
          {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Actualizar comision"}</Button>
        </div>
      </form>
    </Card>
  );
}
