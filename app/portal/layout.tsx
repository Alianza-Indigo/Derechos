import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { APP_NAME } from "@/lib/constants";
import { getCurrentUser } from "@/server/queries/app";

export const dynamic = "force-dynamic";

const links = [
  { href: "/portal", label: "Inicio" },
  { href: "/portal/reporte", label: "Levantar reporte" },
  { href: "/portal/mis-reportes", label: "Mis reportes" },
  { href: "/portal/perfil", label: "Mis datos" },
];

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Solo miembros: el personal usa el panel operativo.
  if (!(user.roles.length === 1 && user.roles[0] === "member")) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-teal-700 text-sm font-bold text-white">DH</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
              <p className="text-xs text-slate-500">Portal del miembro · {user.name}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
