import Link from "next/link";
import type { ReactNode } from "react";
import { navigationItems, APP_NAME } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { getCurrentUser } from "@/server/queries/app";
import { LogoutButton } from "@/components/layout/logout-button";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">DH</div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Operacion institucional</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100")}>
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Plataforma integral</p>
            <h1 className="text-lg font-semibold text-slate-950">Derechos humanos y operacion territorial</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-950">{user.name}</p>
              <p className="text-xs text-slate-500">{user.roles.join(", ")}</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials(user.name)}</div>
            <LogoutButton />
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 gap-1 border-t border-slate-200 bg-white p-2 lg:hidden">
          {navigationItems.slice(0, 5).map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-600">
              <item.icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
