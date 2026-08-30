"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm({ presetOrgCode }: { presetOrgCode?: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      orgCode: presetOrgCode ?? formData.get("orgCode"),
      redirect: false,
    });
    setPending(false);
    if (result?.ok) {
      // Recarga completa al mismo origen: no depende de NEXTAUTH_URL y asegura
      // que los componentes de servidor tomen la nueva sesion. El layout enruta
      // a los miembros hacia /portal y al personal al panel.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/dashboard";
      return;
    }
    setError("Credenciales invalidas o usuario inactivo.");
  }

  return (
    <form action={submit} className="space-y-4">
      <label>
        <span className="text-sm font-medium text-slate-700">Correo</span>
        <input name="email" type="email" autoComplete="username" placeholder="tu@correo.org" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium text-slate-700">Contrasena</span>
        <input name="password" type="password" autoComplete="current-password" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      {presetOrgCode ? null : (
        <label>
          <span className="text-sm font-medium text-slate-700">Codigo de organizacion <span className="font-normal text-slate-400">(solo si tu correo pertenece a mas de una)</span></span>
          <input name="orgCode" type="text" autoComplete="off" placeholder="Ej. AI" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm uppercase" />
        </label>
      )}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar al panel"}</Button>
    </form>
  );
}
