"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateLocationSettingAction, updateOrganizationAction, updateTerritoryLocationSettingAction } from "@/server/actions/platform";
import type { LocationTrackingSetting } from "@/lib/types";

type TerritorySetting = { territoryId: string; name: string; type: string; enabled: boolean; mode: string; retentionDays: number };

type Organization = {
  name: string;
  legalName?: string | null;
  country: string;
  primaryColor: string;
  logoUrl?: string | null;
  geolocationEnabled: boolean;
  aiEnabled: boolean;
};

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>;
}

export function OrganizationForm({ organization }: { organization: Organization }) {
  const [state, action, pending] = useActionState(updateOrganizationAction, null);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label><span className="text-sm font-medium text-slate-700">Nombre publico</span>
        <input name="name" defaultValue={organization.name} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium text-slate-700">Razon social</span>
        <input name="legalName" defaultValue={organization.legalName ?? ""} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium text-slate-700">Pais base</span>
        <input name="country" defaultValue={organization.country} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium text-slate-700">Color primario</span>
        <input name="primaryColor" type="color" defaultValue={organization.primaryColor} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-1 text-sm" /></label>
      <label><span className="text-sm font-medium text-slate-700">Logotipo (URL)</span>
        <input name="logoUrl" defaultValue={organization.logoUrl ?? ""} placeholder="https://..." className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium text-slate-700">Geolocalizacion</span>
        <select name="geolocationEnabled" defaultValue={String(organization.geolocationEnabled)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="true">Activa</option><option value="false">Deshabilitada</option>
        </select></label>
      <label><span className="text-sm font-medium text-slate-700">Asistente IA</span>
        <select name="aiEnabled" defaultValue={String(organization.aiEnabled)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="true">Activo</option><option value="false">Deshabilitado</option>
        </select></label>
      <div className="md:col-span-2 space-y-2"><Msg state={state} /><Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar configuracion"}</Button></div>
    </form>
  );
}

const MODES = ["disabled", "manual_check_in", "during_commission", "active_shift"] as const;

function SettingRow({ setting, label }: { setting: LocationTrackingSetting; label: string }) {
  const [state, action, pending] = useActionState(updateLocationSettingAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b border-slate-100 py-3">
      <input type="hidden" name="id" value={setting.id} />
      <div className="min-w-40"><p className="text-sm font-medium text-slate-700">{label}</p><Msg state={state} /></div>
      <label className="text-sm"><span className="mr-2">Estado</span>
        <select name="enabled" defaultValue={String(setting.enabled)} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          <option value="true">Habilitada</option><option value="false">Pausada</option>
        </select></label>
      <label className="text-sm"><span className="mr-2">Modo</span>
        <select name="mode" defaultValue={setting.mode} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>
      <label className="text-sm"><span className="mr-2">Retencion (dias)</span>
        <input name="retentionDays" type="number" min={1} max={365} defaultValue={setting.retentionDays} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-sm" /></label>
      <Button type="submit" disabled={pending}>{pending ? "..." : "Guardar"}</Button>
    </form>
  );
}

export function LocationSettingsEditor({ settings, labels }: { settings: LocationTrackingSetting[]; labels: Record<string, string> }) {
  return <div>{settings.map((setting) => <SettingRow key={setting.id} setting={setting} label={labels[setting.userId] ?? "Usuario"} />)}</div>;
}

function TerritoryRow({ setting }: { setting: TerritorySetting }) {
  const [state, action, pending] = useActionState(updateTerritoryLocationSettingAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b border-slate-100 py-3">
      <input type="hidden" name="territoryId" value={setting.territoryId} />
      <div className="min-w-40"><p className="text-sm font-medium text-slate-700">{setting.name}</p><span className="text-xs text-slate-500">{setting.type}</span><Msg state={state} /></div>
      <label className="text-sm"><span className="mr-2">Estado</span>
        <select name="enabled" defaultValue={String(setting.enabled)} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          <option value="true">Habilitada</option><option value="false">Deshabilitada</option>
        </select></label>
      <label className="text-sm"><span className="mr-2">Modo</span>
        <select name="mode" defaultValue={setting.mode} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>
      <label className="text-sm"><span className="mr-2">Retencion (dias)</span>
        <input name="retentionDays" type="number" min={1} max={365} defaultValue={setting.retentionDays} className="h-9 w-24 rounded-md border border-slate-300 px-2 text-sm" /></label>
      <Button type="submit" disabled={pending}>{pending ? "..." : "Guardar"}</Button>
    </form>
  );
}

export function TerritoryLocationEditor({ settings }: { settings: TerritorySetting[] }) {
  return <div>{settings.map((setting) => <TerritoryRow key={setting.territoryId} setting={setting} />)}</div>;
}
