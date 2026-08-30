"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateLandingAction } from "@/server/actions/platform";
import type { LandingContent } from "@/lib/landing";

const inputCls = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
const areaCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export function LandingForm({ landing, publicUrl }: { landing: LandingContent; publicUrl?: string }) {
  const [state, action, pending] = useActionState(updateLandingAction, null);
  return (
    <form action={action} className="space-y-4 px-4 pb-4">
      {publicUrl ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Tu sitio publico: <span className="font-mono">{publicUrl}</span>
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="published" defaultChecked={landing.published} className="size-4" />
        Publicar la landing (visible para el publico en tu subdominio/dominio)
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="acceptsPublicReports" defaultChecked={landing.acceptsPublicReports ?? false} className="size-4" />
        Recibir reportes/denuncias del publico (formulario en la landing)
      </label>

      <label className="block"><span className="text-sm font-medium text-slate-700">Lema / tagline</span>
        <input name="tagline" defaultValue={landing.tagline ?? ""} maxLength={160} className={inputCls} placeholder="Defendemos los derechos de..." />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Quienes somos</span>
        <textarea name="about" defaultValue={landing.about ?? ""} rows={4} className={areaCls} placeholder="Breve descripcion de la organizacion." />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Nuestra mision</span>
        <textarea name="mission" defaultValue={landing.mission ?? ""} rows={3} className={areaCls} />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Imagen de portada (URL)</span>
        <input name="heroImageUrl" defaultValue={landing.heroImageUrl ?? ""} className={inputCls} placeholder="https://..." />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-slate-700">Correo de contacto</span>
          <input name="contactEmail" type="email" defaultValue={landing.contactEmail ?? ""} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Telefono</span>
          <input name="contactPhone" defaultValue={landing.contactPhone ?? ""} className={inputCls} />
        </label>
        <label className="block sm:col-span-2"><span className="text-sm font-medium text-slate-700">Direccion</span>
          <input name="address" defaultValue={landing.address ?? ""} className={inputCls} />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Sitio web</span>
          <input name="website" defaultValue={landing.website ?? ""} className={inputCls} placeholder="https://..." />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Facebook</span>
          <input name="facebook" defaultValue={landing.facebook ?? ""} className={inputCls} placeholder="https://..." />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Instagram</span>
          <input name="instagram" defaultValue={landing.instagram ?? ""} className={inputCls} placeholder="https://..." />
        </label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Twitter / X</span>
          <input name="twitter" defaultValue={landing.twitter ?? ""} className={inputCls} placeholder="https://..." />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar landing"}</Button>
        {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
      </div>
    </form>
  );
}
