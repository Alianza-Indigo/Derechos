"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateProviderAction } from "@/server/actions/platform";
import type { AiProviderConfig } from "@/lib/types";

function ProviderRow({ provider }: { provider: AiProviderConfig }) {
  const [state, action, pending] = useActionState(updateProviderAction, null);
  return (
    <form action={action} className="grid gap-3 border-b border-slate-100 py-4 md:grid-cols-5 md:items-end">
      <input type="hidden" name="id" value={provider.id} />
      <div>
        <p className="text-sm font-semibold text-slate-800">{provider.displayName}</p>
        {state?.message ? <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</p> : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" value="true" defaultChecked={provider.enabled} className="size-4" />
        Habilitado
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">Modelo default</span>
        <input name="defaultModel" defaultValue={provider.defaultModel} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">Prioridad</span>
        <input name="priority" type="number" min={1} max={99} defaultValue={provider.priority} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">API key (opcional)</span>
        <input name="apiKey" type="password" placeholder="Dejar vacio para conservar" autoComplete="off" className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <div className="md:col-span-5">
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar proveedor"}</Button>
      </div>
    </form>
  );
}

export function ProviderEditor({ providers }: { providers: AiProviderConfig[] }) {
  return (
    <div>
      {providers.map((provider) => (
        <ProviderRow key={provider.id} provider={provider} />
      ))}
    </div>
  );
}
