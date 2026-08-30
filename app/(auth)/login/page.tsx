import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspendida?: string }> }) {
  const { suspendida } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-teal-700 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Acceso institucional</h1>
            <p className="text-sm text-slate-600">Autenticacion preparada para Auth.js y RBAC territorial.</p>
          </div>
        </div>
        {suspendida ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu organizacion esta suspendida. Contacta a la administracion de la plataforma.
          </p>
        ) : null}
        <LoginForm />
        <p className="mt-4 text-xs text-slate-500">Login demo local. En produccion usa `AUTH_SECRET`, `DATABASE_URL` y proveedor Auth.js.</p>
      </section>
    </main>
  );
}
