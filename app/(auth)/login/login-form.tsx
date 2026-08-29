"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setPending(false);
    if (result?.ok) {
      window.location.href = result.url || "/dashboard";
      return;
    }
    setError("Credenciales invalidas o usuario inactivo.");
  }

  return (
    <form action={submit} className="space-y-4">
      <label>
        <span className="text-sm font-medium text-slate-700">Correo</span>
        <input name="email" defaultValue="admin@demo.org" type="email" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      <label>
        <span className="text-sm font-medium text-slate-700">Contrasena</span>
        <input name="password" defaultValue="demo-seguro" type="password" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar al panel"}</Button>
    </form>
  );
}
