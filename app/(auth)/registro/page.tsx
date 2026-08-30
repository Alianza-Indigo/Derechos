import { Building2 } from "lucide-react";
import { RegistroForm } from "./registro-form";

export const dynamic = "force-dynamic";

export default function RegistroPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Registrar organizacion</h1>
            <p className="text-sm text-slate-600">Crea tu espacio aislado en la plataforma.</p>
          </div>
        </div>
        <RegistroForm />
      </section>
    </main>
  );
}
