import type { CSSProperties } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";
import { resolveTenantFromHeaders } from "@/server/queries/tenant";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspendida?: string }> }) {
  const { suspendida } = await searchParams;
  // Si la peticion llega por el subdominio o dominio propio de un inquilino, se
  // tematiza el acceso con su marca y se acota el login a esa organizacion.
  const tenant = await resolveTenantFromHeaders();
  const brandStyle = { "--brand": tenant?.primaryColor || "#0f766e" } as CSSProperties;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4" style={brandStyle}>
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={tenant.name} className="size-11 rounded-lg object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-lg bg-[var(--brand,#0f766e)] text-white">
              <ShieldCheck className="size-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-950">{tenant ? tenant.name : "Acceso institucional"}</h1>
            <p className="text-sm text-slate-600">
              {tenant ? "Acceso a tu organizacion." : "Autenticacion preparada para Auth.js y RBAC territorial."}
            </p>
          </div>
        </div>
        {suspendida ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tu organizacion esta suspendida. Contacta a la administracion de la plataforma.
          </p>
        ) : null}
        <LoginForm presetOrgCode={tenant?.code} />
        {!tenant ? (
          <p className="mt-4 text-xs text-slate-500">
            Login demo local. En produccion usa `AUTH_SECRET`, `DATABASE_URL` y proveedor Auth.js.{" "}
            <Link href="/registro" className="text-teal-700 underline">Registrar una organizacion</Link>.
          </p>
        ) : null}
      </section>
    </main>
  );
}
