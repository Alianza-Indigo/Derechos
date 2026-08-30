"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetOrgAdminPasswordAction, updateOrganizationDetailsAction } from "@/server/actions/tenants";
import type { OrgAdmin, OrganizationDetail } from "@/server/queries/platform";

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span>;
}

const inputCls = "mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm";

export function OrganizationDetailsForm({ org }: { org: OrganizationDetail }) {
  const [state, action, pending] = useActionState(updateOrganizationDetailsAction, null);
  return (
    <form action={action} className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
      <input type="hidden" name="organizationId" value={org.id} />
      <label className="block"><span className="text-sm font-medium text-slate-700">Nombre publico</span>
        <input name="name" defaultValue={org.name} required className={inputCls} />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Razon social</span>
        <input name="legalName" defaultValue={org.legalName ?? ""} className={inputCls} />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Pais base</span>
        <input name="country" defaultValue={org.country} required className={inputCls} />
      </label>
      <label className="block"><span className="text-sm font-medium text-slate-700">Color primario</span>
        <input name="primaryColor" type="color" defaultValue={org.primaryColor || "#0f766e"} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-1" />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar datos"}</Button>
        <Msg state={state} />
      </div>
    </form>
  );
}

function AdminReset({ orgId, admin }: { orgId: string; admin: OrgAdmin }) {
  const [state, action, pending] = useActionState(resetOrgAdminPasswordAction, null);
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{admin.name} <span className="text-xs text-slate-500">({admin.status})</span></p>
          <p className="text-xs text-slate-500">{admin.email}</p>
        </div>
      </div>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="organizationId" value={orgId} />
        <input type="hidden" name="userId" value={admin.id} />
        <input name="password" type="password" placeholder="Nueva contrasena (min 8)" autoComplete="new-password" className="h-9 w-56 rounded-md border border-slate-300 px-2 text-sm" />
        <Button type="submit" variant="secondary" className="h-9 px-3 text-sm" disabled={pending}>{pending ? "..." : "Restablecer contrasena"}</Button>
        <Msg state={state} />
      </form>
    </div>
  );
}

export function OrganizationAdmins({ orgId, admins }: { orgId: string; admins: OrgAdmin[] }) {
  if (!admins.length) {
    return <p className="px-4 pb-4 text-sm text-slate-500">Esta organizacion no tiene administradores con rol super_admin.</p>;
  }
  return (
    <div className="space-y-3 px-4 pb-4">
      {admins.map((admin) => <AdminReset key={admin.id} orgId={orgId} admin={admin} />)}
    </div>
  );
}
