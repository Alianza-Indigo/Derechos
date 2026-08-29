"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateLocationSettingAction } from "@/server/actions/platform";
import type { LocationTrackingSetting } from "@/lib/types";

const MODES = ["disabled", "manual_check_in", "during_commission", "active_shift"] as const;

function SettingRow({ setting, label }: { setting: LocationTrackingSetting; label: string }) {
  const [state, action, pending] = useActionState(updateLocationSettingAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b border-slate-100 py-3">
      <input type="hidden" name="id" value={setting.id} />
      <div className="min-w-40">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {state?.message ? <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</p> : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" value="true" defaultChecked={setting.enabled} className="size-4" />
        Habilitada
      </label>
      <label className="text-sm">
        <span className="mr-2">Modo</span>
        <select name="mode" defaultValue={setting.mode} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          {MODES.map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mr-2">Retencion (dias)</span>
        <input name="retentionDays" type="number" min={1} max={365} defaultValue={setting.retentionDays} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <Button type="submit" disabled={pending}>{pending ? "..." : "Guardar"}</Button>
    </form>
  );
}

export function LocationSettingsEditor({ settings, labels }: { settings: LocationTrackingSetting[]; labels: Record<string, string> }) {
  return (
    <div>
      {settings.map((setting) => (
        <SettingRow key={setting.id} setting={setting} label={labels[setting.userId] ?? "Usuario"} />
      ))}
    </div>
  );
}
