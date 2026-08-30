"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { registerOrganizationAction } from "@/server/actions/tenants";

export function RegistroForm() {
  const [state, action, pending] = useActionState(registerOrganizationAction, null);

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{state.message}</p>
        <Link href="/login" className="text-sm text-teal-700 underline">Volver al acceso</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Tu organizacion</div>
      <input name="name" placeholder="Nombre de la organizacion" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      <input name="legalName" placeholder="Razon social (opcional)" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="slug" placeholder="Identificador: mi-organizacion" required className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
        <input name="code" placeholder="Codigo: MO" required className="h-10 rounded-md border border-slate-300 px-3 text-sm uppercase" />
      </div>
      <input name="country" placeholder="Pais base" defaultValue="Mexico" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />

      <div className="pt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Tu cuenta de administrador</div>
      <input name="adminName" placeholder="Tu nombre" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      <input name="adminEmail" type="email" placeholder="Tu correo" required className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      <input name="adminPassword" type="password" placeholder="Contrasena (min 8)" required autoComplete="new-password" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />

      {state && !state.ok ? <p className="text-sm text-rose-700">{state.message}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando..." : "Registrar organizacion"}</Button>
      <p className="text-xs text-slate-500">
        Tu organizacion quedara pendiente de aprobacion. Una vez activada podras iniciar sesion.{" "}
        <Link href="/login" className="text-teal-700 underline">Ya tengo cuenta</Link>.
      </p>
    </form>
  );
}
