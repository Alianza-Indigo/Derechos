"use client";

import { useActionState, useState } from "react";
import type { FieldCommission, Territory } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function CheckInForm({
  action,
  territories,
  commissions,
}: {
  action: (state: { ok: boolean; message: string } | null, formData: FormData) => Promise<{ ok: boolean; message: string }>;
  territories: Territory[];
  commissions: FieldCommission[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [coords, setCoords] = useState({ latitude: "28.6353", longitude: "-106.0889", accuracyMeters: "50" });

  function detectLocation() {
    navigator.geolocation?.getCurrentPosition((position) => {
      setCoords({
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
        accuracyMeters: String(Math.round(position.coords.accuracy)),
      });
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <Button type="button" variant="secondary" onClick={detectLocation}>Detectar ubicacion</Button>
      <input type="hidden" name="latitude" value={coords.latitude} />
      <input type="hidden" name="longitude" value={coords.longitude} />
      <input type="hidden" name="accuracyMeters" value={coords.accuracyMeters} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Territorio</span>
        <select name="territoryId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Comision</span>
        <select name="fieldCommissionId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="">Sin comision</option>
          {commissions.map((commission) => <option key={commission.id} value={commission.id}>{commission.title}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Modalidad</span>
        <select name="captureMode" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="manual">Check-in manual</option>
          <option value="commission">Durante comision</option>
          <option value="shift">Jornada activa</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">Coordenadas actuales: {coords.latitude}, {coords.longitude} · precision {coords.accuracyMeters}m</p>
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button disabled={pending}>{pending ? "Registrando..." : "Registrar check-in"}</Button>
    </form>
  );
}
