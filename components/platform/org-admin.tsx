"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createOrganizationAction, setOrganizationStatusAction } from "@/server/actions/tenants";
import type { OrganizationRow } from "@/server/queries/platform";

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span>;
}

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

function StatusToggle({ org }: { org: OrganizationRow }) {
  const [state, action, pending] = useActionState(setOrganizationStatusAction, null);
  const next = org.status === "active" ? "suspended" : "active";
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={org.id} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" variant={org.status === "active" ? "danger" : "primary"} className="h-8 px-3 text-xs" disabled={pending}>
        {pending ? "..." : org.status === "active" ? "Suspender" : "Reactivar"}
      </Button>
      <Msg state={state} />
    </form>
  );
}

export function OrganizationsTable({ organizations }: { organizations: OrganizationRow[] }) {
  return (
    <div className="space-y-4">
      {organizations.map((org) => (
        <div key={org.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">
                {org.name}{" "}
                <Badge tone={org.status === "active" ? "green" : "amber"}>{org.status === "active" ? "activa" : "suspendida"}</Badge>
              </p>
              <p className="text-xs text-slate-500">
                slug: <span className="font-mono">{org.slug}</span> · codigo: <span className="font-mono">{org.code}</span> · {org.country}
              </p>
            </div>
            <StatusToggle org={org} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span>{org.counts.users} usuarios</span>
            <span>{org.counts.members} miembros</span>
            <span>{org.counts.cases} casos</span>
          </div>
        </div>
      ))}
    </div>
  );
}
