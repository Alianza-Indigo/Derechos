"use client";

import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { caseStatuses } from "@/lib/constants";
import { addEvidenceAction, createPrevalenceRecordAction, updateCaseStatusAction, updateProviderConfigAction } from "@/server/actions/platform";
import type { AiProviderConfig, PrevalenceMetric, PrevalenceStudy, Territory } from "@/lib/types";

export function CaseStatusForm({ caseId, statuses }: { caseId: string; statuses: typeof caseStatuses }) {
  const [state, formAction, pending] = useActionState(updateCaseStatusAction, null);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
      <input type="hidden" name="caseId" value={caseId} />
      <select name="status" className="h-10 rounded-md border border-slate-300 px-3 text-sm">
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <input name="reason" placeholder="Motivo obligatorio del cambio de estado" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <Button disabled={pending}>{pending ? "Guardando..." : "Cambiar estado"}</Button>
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700 md:col-span-3" : "text-sm text-rose-700 md:col-span-3"}>{state.message}</p> : null}
    </form>
  );
}

export function EvidenceForm({ entityId, entityType }: { entityId: string; entityType: "case" | "event" }) {
  const [state, formAction, pending] = useActionState(addEvidenceAction, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    const payload = new FormData(event.currentTarget);
    const file = payload.get("file");

    if (file instanceof File && file.size > 0) {
      setUploading(true);
      const uploadPayload = new FormData();
      uploadPayload.set("file", file);
      uploadPayload.set("entityType", `${entityType}-evidence`);
      const response = await fetch("/api/upload", { method: "POST", body: uploadPayload });
      setUploading(false);
      if (!response.ok) {
        setUploadError("No se pudo subir el archivo de evidencia.");
        return;
      }
      const result = await response.json() as { url: string };
      payload.set("fileUrl", result.url);
      payload.set("fileType", file.type || "application/octet-stream");
    }

    formAction(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="entityType" value={entityType} />
      <input name="file" type="file" className="h-10 rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <input name="fileUrl" placeholder="URL de evidencia ya cargada" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="fileType" placeholder="Tipo MIME" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="description" placeholder="Descripcion de evidencia" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <Button disabled={pending || uploading}>{pending || uploading ? "Registrando..." : "Agregar"}</Button>
      {uploadError ? <p className="text-sm text-rose-700 md:col-span-4">{uploadError}</p> : null}
      {state?.message ? <p className={state.ok ? "text-sm text-emerald-700 md:col-span-4" : "text-sm text-rose-700 md:col-span-4"}>{state.message}</p> : null}
    </form>
  );
}

export function PrevalenceCaptureForm({ studies, metrics, territories }: { studies: PrevalenceStudy[]; metrics: PrevalenceMetric[]; territories: Territory[] }) {
  const [state, formAction, pending] = useActionState(createPrevalenceRecordAction, null);
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <label><span className="text-sm font-medium">Estudio</span><select name="studyId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{studies.map((study) => <option key={study.id} value={study.id}>{study.name}</option>)}</select></label>
      <label><span className="text-sm font-medium">Indicador</span><select name="metricId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label>
      <label><span className="text-sm font-medium">Territorio</span><select name="territoryId" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">{territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}</select></label>
      <label><span className="text-sm font-medium">Valor numerico</span><input name="valueNumeric" type="number" step="0.01" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium">Tamano de muestra</span><input name="sampleSize" type="number" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium">Fuente</span><input name="source" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <label><span className="text-sm font-medium">Fecha de medicion</span><input name="measuredAt" type="date" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /></label>
      <div className="md:col-span-2">
        {state?.message ? <p className={state.ok ? "mb-3 text-sm text-emerald-700" : "mb-3 text-sm text-rose-700"}>{state.message}</p> : null}
        <Button disabled={pending}>{pending ? "Guardando..." : "Guardar medicion"}</Button>
      </div>
    </form>
  );
}

export function ProviderConfigForm({ provider }: { provider: AiProviderConfig }) {
  const [state, formAction, pending] = useActionState(updateProviderConfigAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="providerKey" value={provider.providerKey} />
      <select name="enabled" defaultValue={String(provider.enabled)} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
        <option value="true">Activo</option>
        <option value="false">Inactivo</option>
      </select>
      <input name="defaultModel" defaultValue={provider.defaultModel} className="h-9 w-44 rounded-md border border-slate-300 px-2 text-xs" />
      <input name="priority" type="number" defaultValue={provider.priority} className="h-9 w-16 rounded-md border border-slate-300 px-2 text-xs" />
      <Button className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Guardar"}</Button>
      {state?.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
