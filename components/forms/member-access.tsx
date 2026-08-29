"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setMemberAccessAction } from "@/server/actions/platform";

export function MemberAccessForm({ memberId, hasAccount }: { memberId: string; hasAccount: boolean }) {
  const [state, action, pending] = useActionState(setMemberAccessAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Contrasena del portal (min 8)" className="h-9 w-56 rounded-md border border-slate-300 px-2 text-xs" />
      <Button type="submit" className="h-9 px-3 text-xs" disabled={pending}>
        {pending ? "..." : hasAccount ? "Restablecer contrasena" : "Crear acceso al portal"}
      </Button>
      {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
    </form>
  );
}
