"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateCredentialAction } from "@/server/actions/platform";

export function CredentialManager({ memberId, status }: { memberId: string; status: string }) {
  const [state, action, pending] = useActionState(updateCredentialAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <Button type="submit" name="action" value="renew" disabled={pending} className="h-9 px-3 text-xs">
        {pending ? "..." : "Renovar (1 anio)"}
      </Button>
      <Button type="submit" name="action" value="suspend" disabled={pending || status === "suspendida"} className="h-9 bg-amber-600 px-3 text-xs hover:bg-amber-700">
        Suspender
      </Button>
      <Button type="submit" name="action" value="revoke" disabled={pending || status === "revocada"} className="h-9 bg-rose-700 px-3 text-xs hover:bg-rose-800">
        Revocar
      </Button>
      {state?.message ? <span className={state.ok ? "text-xs text-emerald-700" : "text-xs text-rose-700"}>{state.message}</span> : null}
    </form>
  );
}
