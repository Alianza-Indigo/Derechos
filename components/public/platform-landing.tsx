import Link from "next/link";
import { Building2, ShieldCheck, Layers, MapPinned } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function PlatformLanding() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold">
            <ShieldCheck className="size-5" />
          </div>
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/registro" className="inline-flex h-9 items-center rounded-md border border-white/20 px-4 text-sm font-medium hover:bg-white/10">Registrar organizacion</Link>
          <Link href="/login" className="inline-flex h-9 items-center rounded-md bg-teal-600 px-4 text-sm font-medium hover:bg-teal-500">Acceder</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-8">
        <h1 className="text-4xl font-bold sm:text-5xl">Plataforma para organizaciones de derechos humanos</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Gestiona miembros, casos, eventos, prevalencia y operacion territorial. Cada organizacion con sus datos
          aislados, su plan, su sitio publico y su marca.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="inline-flex h-11 items-center rounded-md bg-teal-600 px-6 text-sm font-medium hover:bg-teal-500">Registrar mi organizacion</Link>
          <Link href="/login" className="inline-flex h-11 items-center rounded-md border border-white/20 px-6 text-sm font-medium hover:bg-white/10">Ya tengo cuenta</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-4 pb-24 sm:grid-cols-3 sm:px-8">
        <Feature icon={<Layers className="size-5" />} title="Multiinquilino" text="Datos, usuarios y configuracion aislados por organizacion." />
        <Feature icon={<MapPinned className="size-5" />} title="Operacion territorial" text="Casos, comisiones de campo y geolocalizacion con control por territorio." />
        <Feature icon={<Building2 className="size-5" />} title="Sitio propio" text="Landing publica con la marca de cada organizacion, por subdominio o dominio propio." />
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-5">
      <div className="flex size-9 items-center justify-center rounded-md bg-teal-600/20 text-teal-300">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{text}</p>
    </div>
  );
}
