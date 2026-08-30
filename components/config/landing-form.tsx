"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateLandingAction } from "@/server/actions/platform";
import { LANDING_LIMITS, type Achievement, type LandingContent, type NewsItem, type TeamMember } from "@/lib/landing";

const inputCls = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm";
const areaCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const rowInput = "h-9 rounded-md border border-slate-300 px-2 text-sm";

// Editor de una seccion repetible (equipo/noticias/logros). Mantiene las filas
// en estado y las serializa a un input oculto JSON que consume el action.
function SectionEditor<T extends Record<string, string | undefined>>({
  title,
  fieldName,
  initial,
  blank,
  max,
  columns,
}: {
  title: string;
  fieldName: string;
  initial: T[];
  blank: T;
  max: number;
  columns: Array<{ key: keyof T; placeholder: string; textarea?: boolean }>;
}) {
  const [rows, setRows] = useState<T[]>(initial);
  const update = (i: number, key: keyof T, value: string) =>
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  const clean = rows.filter((row) => Object.values(row).some((v) => (v ?? "").toString().trim()));
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{title} <span className="font-normal text-slate-400">({clean.length}/{max})</span></span>
        <button
          type="button"
          onClick={() => setRows((prev) => (prev.length >= max ? prev : [...prev, { ...blank }]))}
          className="text-xs font-medium text-[var(--brand,#0f766e)] underline disabled:opacity-40"
          disabled={rows.length >= max}
        >
          + Agregar
        </button>
      </div>
      <input type="hidden" name={fieldName} value={JSON.stringify(clean)} />
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? <p className="text-xs text-slate-400">Sin elementos.</p> : null}
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2">
            {columns.map((col) =>
              col.textarea ? (
                <textarea
                  key={String(col.key)}
                  value={row[col.key] ?? ""}
                  onChange={(e) => update(i, col.key, e.target.value)}
                  placeholder={col.placeholder}
                  rows={2}
                  className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              ) : (
                <input
                  key={String(col.key)}
                  value={row[col.key] ?? ""}
                  onChange={(e) => update(i, col.key, e.target.value)}
                  placeholder={col.placeholder}
                  className={`${rowInput} min-w-[10rem] flex-1`}
                />
              ),
            )}
            <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="h-9 px-2 text-rose-600 hover:text-rose-800" title="Quitar">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

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

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Secciones del sitio</p>
        <SectionEditor<TeamMember>
          title="Equipo"
          fieldName="teamJson"
          initial={landing.team ?? []}
          blank={{ name: "", role: "", photoUrl: "" }}
          max={LANDING_LIMITS.team}
          columns={[
            { key: "name", placeholder: "Nombre" },
            { key: "role", placeholder: "Cargo" },
            { key: "photoUrl", placeholder: "Foto (URL)" },
          ]}
        />
        <SectionEditor<NewsItem>
          title="Noticias / comunicados"
          fieldName="newsJson"
          initial={landing.news ?? []}
          blank={{ title: "", date: "", body: "", link: "" }}
          max={LANDING_LIMITS.news}
          columns={[
            { key: "title", placeholder: "Titulo" },
            { key: "date", placeholder: "Fecha (ej. 2026-08-01)" },
            { key: "body", placeholder: "Resumen", textarea: true },
            { key: "link", placeholder: "Enlace (URL)" },
          ]}
        />
        <SectionEditor<Achievement>
          title="Logros / indicadores"
          fieldName="achievementsJson"
          initial={landing.achievements ?? []}
          blank={{ label: "", value: "", description: "" }}
          max={LANDING_LIMITS.achievements}
          columns={[
            { key: "value", placeholder: "Dato (ej. 1,200)" },
            { key: "label", placeholder: "Etiqueta (ej. casos atendidos)" },
            { key: "description", placeholder: "Detalle (opcional)" },
          ]}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar landing"}</Button>
        {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
      </div>
    </form>
  );
}
