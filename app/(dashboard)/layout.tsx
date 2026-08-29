import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/server/queries/app";

// El panel siempre lee de la base de datos y de la sesion: nunca se prerenderiza.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Los miembros no usan el panel operativo: van a su portal.
  if (user.roles.length === 1 && user.roles[0] === "member") {
    redirect("/portal");
  }
  return <AppShell>{children}</AppShell>;
}
