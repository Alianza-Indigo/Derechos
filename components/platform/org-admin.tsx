"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_KEYS, planLabel } from "@/lib/plans";
import {
  createOrganizationAction,
  setOrganizationDomainAction,
  setOrganizationPlanAction,
  setOrganizationStatusAction,
} from "@/server/actions/tenants";
import type { OrganizationRow } from "@/server/queries/platform";

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span>;
}

const statusTone: Record<string, "green" | "amber" | "slate"> = { active: "green", pending: "amber", suspended: "slate" };
const statusLabel: Record<string, string> = { active: "activa", pending: "pendiente", suspended: "suspendida" };

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2 text-xs font-medium uppercase tracking-wide text-slate-500">Organizacion</div>
      <input name="name" placeholder="Nombre publico" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="legalName" placeholder="Razon social (opcional)" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="slug" placeholder="Identificador (slug): alianza-indigo" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="code" placeholder="Codigo: AI (folios)" required className="h-10 rounded-md border border-slate-300 px-3 text-sm uppercase" />
      <input name="country" placeholder="Pais base" defaultValue="Mexico" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="primaryColor" placeholder="Color #RRGGBB (opcional)" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <select name="plan" defaultValue="institucional" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
        {PLAN_KEYS.map((key) => <option key={key} value={key}>Plan {planLabel(key)}</option>)}
      </select>
      <div className="md:col-span-2 mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Primer administrador</div>
      <input name="adminName" placeholder="Nombre del administrador" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="adminEmail" type="email" placeholder="Correo del administrador" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="adminPassword" type="password" placeholder="Contrasena inicial (min 8)" required autoComplete="new-password" className="h-10 rounded-md border border-slate-300 px-3 text-sm md:col-span-2" />
      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creando..." : "Crear organizacion"}</Button>
        <Msg state={state} />
      </div>
    </form>
  );
}

export function StatusControls({ org }: { org: OrganizationRow }) {
  const [state, action, pending] = useActionState(setOrganizationStatusAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={org.id} />
      {org.status === "active" ? (
        <>
          <input type="hidden" name="status" value="suspended" />
          <Button type="submit" variant="danger" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : "Suspender"}</Button>
        </>
      ) : (
        <>
          <input type="hidden" name="status" value="active" />
          <Button type="submit" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : org.status === "pending" ? "Aprobar" : "Reactivar"}</Button>
        </>
      )}
      <Msg state={state} />
    </form>
  );
}

export function PlanControl({ org }: { org: OrganizationRow }) {
  const [state, action, pending] = useActionState(setOrganizationPlanAction, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={org.id} />
      <select name="plan" defaultValue={org.plan} className="h-8 rounded-md border border-slate-300 px-2 text-xs">
        {PLAN_KEYS.map((key) => <option key={key} value={key}>{planLabel(key)}</option>)}
      </select>
      <Button type="submit" variant="secondary" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : "Plan"}</Button>
      <Msg state={state} />
    </form>
  );
}

export function DomainControl({ org }: { org: OrganizationRow }) {
  const [state, action, pending] = useActionState(setOrganizationDomainAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="organizationId" value={org.id} />
      <input name="customDomain" defaultValue={org.customDomain ?? ""} placeholder="dominio propio (ej. derechos.miorg.org)" className="h-8 w-64 rounded-md border border-slate-300 px-2 text-xs" />
      <Button type="submit" variant="secondary" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : "Dominio"}</Button>
      <Msg state={state} />
    </form>
  );
}

export function OrganizationsTable({ organizations, rootDomain }: { organizations: OrganizationRow[]; rootDomain?: string }) {
  return (
    <div className="space-y-4">
      {organizations.map((org) => (
        <div key={org.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">
                <Link href={`/plataforma/${org.id}`} className="hover:underline">{org.name}</Link>{" "}
                <Badge tone={statusTone[org.status] ?? "slate"}>{statusLabel[org.status] ?? org.status}</Badge>{" "}
                <Badge tone="slate">plan {planLabel(org.plan)}</Badge>
              </p>
              <p className="text-xs text-slate-500">
                slug: <span className="font-mono">{org.slug}</span> · codigo: <span className="font-mono">{org.code}</span> · {org.country}
                {rootDomain ? <> · <span className="font-mono">{org.slug}.{rootDomain}</span></> : null}
                {org.customDomain ? <> · dominio propio: <span className="font-mono">{org.customDomain}</span></> : null}
              </p>
            </div>
            <StatusControls org={org} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span>{org.counts.users} usuarios</span>
            <span>{org.counts.members} miembros</span>
            <span>{org.counts.cases} casos</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <PlanControl org={org} />
            <DomainControl org={org} />
          </div>
        </div>
      ))}
    </div>
  );
}
