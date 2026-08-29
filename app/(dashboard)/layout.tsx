import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// El panel siempre lee de la base de datos y de la sesion: nunca se prerenderiza.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
