"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/constants";
import { assignUserRoleAction, createUserAction, removeUserRoleAction, setUserStatusAction } from "@/server/actions/platform";
import type { AdminUserRow } from "@/server/queries/app";
import type { Territory } from "@/lib/types";

const roleEntries = Object.entries(roleLabels);

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span>;
}

export function CreateUserForm({ territories }: { territories: Territory[] }) {
  const [state, action, pending] = useActionState(createUserAction, null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <input name="name" placeholder="Nombre completo" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="email" type="email" placeholder="Correo" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="phone" placeholder="Telefono (opcional)" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
      <input name="password" type="password" placeholder="Contrasena (min 8)" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" autoComplete="new-password" />
      <select name="role" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
        {roleEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <select name="territoryId" className="h-10 rounded-md border border-slate-300 px-2 text-sm">
        <option value="">Alcance global (sin territorio)</option>
        {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
      </select>
      <div className="md:col-span-3 flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creando..." : "Crear usuario"}</Button>
        <Msg state={state} />
      </div>
    </form>
  );
}

function StatusToggle({ user }: { user: AdminUserRow }) {
  const [state, action, pending] = useActionState(setUserStatusAction, null);
  const next = user.status === "active" ? "disabled" : "active";
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" variant={user.status === "active" ? "danger" : "primary"} className="h-8 px-3 text-xs" disabled={pending}>
        {pending ? "..." : user.status === "active" ? "Desactivar" : "Activar"}
      </Button>
      <Msg state={state} />
    </form>
  );
}

function RoleAssign({ user, territories }: { user: AdminUserRow; territories: Territory[] }) {
  const [state, action, pending] = useActionState(assignUserRoleAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <select name="role" className="h-8 rounded-md border border-slate-300 px-2 text-xs">
        {roleEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <select name="territoryId" className="h-8 rounded-md border border-slate-300 px-2 text-xs">
        <option value="">Global</option>
        {territories.map((territory) => <option key={territory.id} value={territory.id}>{territory.name}</option>)}
      </select>
      <Button type="submit" className="h-8 px-3 text-xs" disabled={pending}>{pending ? "..." : "Asignar rol"}</Button>
      <Msg state={state} />
    </form>
  );
}

function RoleRemove({ userId, role, scopeType, scopeId }: { userId: string; role: string; scopeType: string; scopeId?: string }) {
  const [state, action, pending] = useActionState(removeUserRoleAction, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="scopeType" value={scopeType} />
      {scopeId ? <input type="hidden" name="scopeId" value={scopeId} /> : null}
      <button type="submit" disabled={pending} className="ml-1 text-rose-600 hover:text-rose-800" title="Quitar rol">×</button>
      <Msg state={state} />
    </form>
  );
}

export function UserAdminTable({ users, territories }: { users: AdminUserRow[]; territories: Territory[] }) {
  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div key={user.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{user.name} <span className="text-xs text-slate-500">({user.status})</span></p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <StatusToggle user={user} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.roles.length ? user.roles.map((assignment, index) => (
              <span key={`${assignment.role}-${assignment.scopeType}-${index}`} className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                {roleLabels[assignment.role as keyof typeof roleLabels] ?? assignment.role} · {assignment.scopeName}
                <RoleRemove userId={user.id} role={assignment.role} scopeType={assignment.scopeType} scopeId={assignment.scopeId} />
              </span>
            )) : <span className="text-xs text-slate-400">Sin roles asignados</span>}
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <RoleAssign user={user} territories={territories} />
          </div>
        </div>
      ))}
    </div>
  );
}
