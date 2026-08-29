"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
      aria-label="Cerrar sesion"
      title="Cerrar sesion"
    >
      <LogOut className="size-4" />
    </button>
  );
}
