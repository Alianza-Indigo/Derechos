"use client";

import { type FormEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { caseStatuses } from "@/lib/constants";
import { addCaseActionAction, addCasePersonAction, addEvidenceAction, createPrevalenceRecordAction, duplicatePromptAction, reassignCaseAction, restorePromptVersionAction, updateCaseStatusAction, updateProviderConfigAction } from "@/server/actions/platform";
import type { AiProviderConfig, PrevalenceMetric, PrevalenceStudy, Territory } from "@/lib/types";

export function CaseReassignForm({ caseId, assignedTo, users }: { caseId: string; assignedTo: string; users: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(reassignCaseAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <select name="assignedTo" defaultValue={assignedTo} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
        {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
      <Button type="submit" className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Reasignar responsable"}</Button>
      {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
    </form>
  );
}

export function CasePersonForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(addCasePersonAction, null);
  return (
    <form action={action} className="grid gap-2 md:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      <select name="personType" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
        {["victima", "solicitante", "autoridad", "testigo", "otro"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select name="consentStatus" className="h-9 rounded-md border border-slate-300 px-2 text-sm">
        {["documentado", "pendiente", "no_aplica"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="name" placeholder="Nombre" required className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
      <input name="contact" placeholder="Contacto (o Reservado)" required className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
      <div className="md:col-span-2 flex items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? "..." : "Agregar persona"}</Button>
        {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
      </div>
    </form>
  );
}

export function CaseActionForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(addCaseActionAction, null);
  return (
    <form action={action} className="grid gap-2 md:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input name="actionType" placeholder="Tipo de accion" required className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
      <input name="dueDate" type="date" className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
      <textarea name="description" placeholder="Descripcion" required className="md:col-span-2 min-h-16 rounded-md border border-slate-300 px-2 py-1 text-sm" />
      <div className="md:col-span-2 flex items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? "..." : "Agregar accion"}</Button>
        {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
      </div>
    </form>
  );
}

export function ProviderTester({ providerKey }: { providerKey: "gemini" | "openai" | "anthropic" }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function test() {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerKey, message: "Prueba de conexion." }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error ?? "Error");
      } else {
        setStatus(`${data.status} (${data.provider}/${data.model})`);
      }
    } catch {
      setStatus("Error de red");
    } finally {
      setLoading(false);
    }
  }
  return (
    <span className="flex items-center gap-2">
      <Button type="button" className="h-9 px-3 text-xs" disabled={loading} onClick={test}>{loading ? "Probando..." : "Probar"}</Button>
      {status ? <span className="text-xs text-slate-600">{status}</span> : null}
    </span>
  );
}

export function DuplicatePromptButton({ promptId }: { promptId: string }) {
  const [state, action, pending] = useActionState(duplicatePromptAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="promptId" value={promptId} />
      <Button type="submit" className="h-8 px-2 text-xs" disabled={pending}>{pending ? "..." : "Duplicar"}</Button>
      {state?.message ? <span className="ml-2 text-xs text-rose-700">{state.message}</span> : null}
    </form>
  );
}

export function RestorePromptButton({ promptId }: { promptId: string }) {
  const [state, action, pending] = useActionState(restorePromptVersionAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="promptId" value={promptId} />
      <Button type="submit" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : "Restaurar esta version"}</Button>
      {state?.message ? <span className="ml-2 text-xs text-rose-700">{state.message}</span> : null}
    </form>
  );
}

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
      <input name="apiKey" type="password" placeholder="API key (opcional)" autoComplete="off" className="h-9 w-40 rounded-md border border-slate-300 px-2 text-xs" />
      <Button className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Guardar"}</Button>
      {state?.message ? <span className="text-xs text-emerald-700">{state.message}</span> : null}
    </form>
  );
}
