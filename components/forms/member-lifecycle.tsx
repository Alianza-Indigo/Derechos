"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMemberAction, setMemberStatusAction, updateMemberPositionAction } from "@/server/actions/platform";

export function MemberPositionForm({ memberId, position }: { memberId: string; position?: string }) {
  const [state, action, pending] = useActionState(updateMemberPositionAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <input name="position" defaultValue={position ?? ""} placeholder="Ej. Presidente, Secretario, Vocal" className="h-9 w-64 rounded-md border border-slate-300 px-2 text-sm" />
      <Button type="submit" className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Guardar puesto"}</Button>
      {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
    </form>
  );
}

const STATUSES = ["pendiente", "activo", "suspendido", "baja", "fallecido"] as const;

export function MemberStatusForm({ memberId, status }: { memberId: string; status: string }) {
  const [state, action, pending] = useActionState(setMemberStatusAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <select name="status" defaultValue={status} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Button type="submit" className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Actualizar estado"}</Button>
      {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
    </form>
  );
}

export function DeleteMemberForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(deleteMemberAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <input name="confirm" placeholder="Escribe ELIMINAR" autoComplete="off" className="h-9 w-40 rounded-md border border-rose-300 px-2 text-xs" />
      <Button type="submit" variant="danger" className="h-9 px-3 text-xs" disabled={pending}>{pending ? "..." : "Eliminar definitivamente"}</Button>
      {state?.message ? <span className="text-xs text-rose-700">{state.message}</span> : null}
    </form>
  );
}
