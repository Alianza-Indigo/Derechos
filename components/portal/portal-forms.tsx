"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { caseCategories } from "@/lib/constants";
import { createMemberReportAction, updateMemberProfileAction } from "@/server/actions/platform";

function Msg({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state?.message) return null;
  return <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>;
}

export function MemberReportForm() {
  const [state, action, pending] = useActionState(createMemberReportAction, null);
  return (
    <form action={action} className="grid gap-4">
      <label>
        <span className="text-sm font-medium text-slate-700">Motivo del reporte</span>
        <input name="title" required placeholder="Ej. Negacion de servicio de salud" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium text-slate-700">Categoria</span>
        <select name="category" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          {caseCategories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        <span className="text-sm font-medium text-slate-700">Descripcion de los hechos</span>
        <textarea name="description" required minLength={20} className="mt-1 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Describe que paso, cuando, donde y quienes participaron." />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="consentStatus" value="documentado" className="size-4" />
        Autorizo el tratamiento de mis datos para dar seguimiento a este reporte.
      </label>
      <div className="space-y-2">
        <Msg state={state} />
        <Button type="submit" disabled={pending}>{pending ? "Enviando..." : "Enviar reporte"}</Button>
      </div>
    </form>
  );
}

type Profile = { phone: string; email: string; address: string };

export function MemberProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateMemberProfileAction, null);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label>
        <span className="text-sm font-medium text-slate-700">Telefono</span>
        <input name="phone" defaultValue={profile.phone} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium text-slate-700">Correo</span>
        <input name="email" type="email" defaultValue={profile.email} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label className="md:col-span-2">
        <span className="text-sm font-medium text-slate-700">Domicilio o referencia</span>
        <input name="address" defaultValue={profile.address} required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <div className="md:col-span-2 space-y-2">
        <Msg state={state} />
        <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar datos"}</Button>
      </div>
    </form>
  );
}
