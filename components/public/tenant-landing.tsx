import type { CSSProperties } from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Globe, ShieldCheck } from "lucide-react";
import type { PublicSite } from "@/server/queries/tenant";

export function TenantLanding({ site }: { site: PublicSite }) {
  const brandStyle = { "--brand": site.primaryColor || "#0f766e" } as CSSProperties;
  const landing = site.landing;
  const published = landing.published;

  return (
    <main className="min-h-screen bg-white text-slate-900" style={brandStyle}>
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logoUrl} alt={site.name} className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand,#0f766e)] text-sm font-bold text-white">
              <ShieldCheck className="size-5" />
            </div>
          )}
          <span className="text-sm font-semibold">{site.name}</span>
        </div>
        <Link href="/login" className="inline-flex h-9 items-center rounded-md bg-[var(--brand,#0f766e)] px-4 text-sm font-medium text-white hover:brightness-95">
          Acceder
        </Link>
      </header>

      {published ? (
        <>
          <section
            className="relative isolate px-4 py-20 sm:px-8"
            style={
              landing.heroImageUrl
                ? { backgroundImage: `linear-gradient(rgba(15,23,42,.55),rgba(15,23,42,.65)), url(${landing.heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            <div className={`mx-auto max-w-3xl ${landing.heroImageUrl ? "text-white" : ""}`}>
              <h1 className="text-3xl font-bold sm:text-4xl">{site.name}</h1>
              {landing.tagline ? <p className="mt-4 text-lg opacity-90">{landing.tagline}</p> : null}
              <div className="mt-8 flex flex-wrap gap-3">
                {landing.acceptsPublicReports ? (
                  <Link href="/reportar" className="inline-flex h-11 items-center rounded-md bg-[var(--brand,#0f766e)] px-5 text-sm font-medium text-white hover:brightness-95">
                    Presentar un reporte
                  </Link>
                ) : null}
                <Link href="/login" className={`inline-flex h-11 items-center rounded-md px-5 text-sm font-medium ${landing.acceptsPublicReports ? "border border-current text-current hover:opacity-80" : "bg-[var(--brand,#0f766e)] text-white hover:brightness-95"}`}>
                  Acceder al panel
                </Link>
                {landing.contactEmail ? (
                  <a href={`mailto:${landing.contactEmail}`} className="inline-flex h-11 items-center rounded-md border border-white/70 bg-white/10 px-5 text-sm font-medium hover:bg-white/20">
                    Contactar
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {(landing.about || landing.mission) ? (
            <section className="mx-auto max-w-3xl space-y-8 px-4 py-14 sm:px-8">
              {landing.about ? (
                <div>
                  <h2 className="text-xl font-semibold">Quienes somos</h2>
                  <p className="mt-3 whitespace-pre-line text-slate-700">{landing.about}</p>
                </div>
              ) : null}
              {landing.mission ? (
                <div>
                  <h2 className="text-xl font-semibold">Nuestra mision</h2>
                  <p className="mt-3 whitespace-pre-line text-slate-700">{landing.mission}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {landing.achievements?.length ? (
            <section className="border-t border-slate-200 px-4 py-12 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-xl font-semibold">Logros e indicadores</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {landing.achievements.map((a, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-5">
                      {a.value ? <p className="text-3xl font-bold text-[var(--brand,#0f766e)]">{a.value}</p> : null}
                      <p className="mt-1 font-medium text-slate-900">{a.label}</p>
                      {a.description ? <p className="mt-1 text-sm text-slate-600">{a.description}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {landing.team?.length ? (
            <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-8">
              <div className="mx-auto max-w-4xl">
                <h2 className="text-xl font-semibold">Nuestro equipo</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {landing.team.map((m, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt={m.name} className="size-14 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--brand,#0f766e)] text-lg font-bold text-white">{m.name.charAt(0)}</div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{m.name}</p>
                        {m.role ? <p className="text-sm text-slate-600">{m.role}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {landing.news?.length ? (
            <section className="border-t border-slate-200 px-4 py-12 sm:px-8">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-xl font-semibold">Noticias y comunicados</h2>
                <div className="mt-6 space-y-6">
                  {landing.news.map((n, i) => (
                    <article key={i} className="border-b border-slate-100 pb-5 last:border-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-slate-900">{n.title}</h3>
                        {n.date ? <span className="text-xs text-slate-500">{n.date}</span> : null}
                      </div>
                      {n.body ? <p className="mt-2 whitespace-pre-line text-slate-700">{n.body}</p> : null}
                      {n.link ? <a href={n.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[var(--brand,#0f766e)] underline">Leer mas</a> : null}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {(landing.contactEmail || landing.contactPhone || landing.address || landing.website) ? (
            <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-8">
              <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
                <h2 className="text-xl font-semibold sm:col-span-2">Contacto</h2>
                {landing.contactEmail ? <p className="flex items-center gap-2 text-slate-700"><Mail className="size-4 text-[var(--brand,#0f766e)]" /> <a href={`mailto:${landing.contactEmail}`} className="hover:underline">{landing.contactEmail}</a></p> : null}
                {landing.contactPhone ? <p className="flex items-center gap-2 text-slate-700"><Phone className="size-4 text-[var(--brand,#0f766e)]" /> {landing.contactPhone}</p> : null}
                {landing.address ? <p className="flex items-center gap-2 text-slate-700"><MapPin className="size-4 text-[var(--brand,#0f766e)]" /> {landing.address}</p> : null}
                {landing.website ? <p className="flex items-center gap-2 text-slate-700"><Globe className="size-4 text-[var(--brand,#0f766e)]" /> <a href={landing.website} target="_blank" rel="noreferrer" className="hover:underline">{landing.website}</a></p> : null}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-8">
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <p className="mt-3 text-slate-600">Sitio en construccion.</p>
          <Link href="/login" className="mt-8 inline-flex h-11 items-center rounded-md bg-[var(--brand,#0f766e)] px-5 text-sm font-medium text-white hover:brightness-95">
            Acceder al panel
          </Link>
        </section>
      )}

      <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 sm:px-8">
        {site.legalName || site.name} · {site.country}
      </footer>
    </main>
  );
}
