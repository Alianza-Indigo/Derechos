import type { CSSProperties } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getPublicSiteFromHeaders } from "@/server/queries/tenant";
import { PublicReportForm } from "@/components/public/report-form";

export const dynamic = "force-dynamic";

export default async function ReportarPage() {
  const site = await getPublicSiteFromHeaders();
  const enabled = Boolean(site?.landing.published && site.landing.acceptsPublicReports);
  const brandStyle = { "--brand": site?.primaryColor || "#0f766e" } as CSSProperties;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10" style={brandStyle}>
      <section className="mx-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          {site?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logoUrl} alt={site.name} className="size-11 rounded-lg object-cover" />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-lg bg-[var(--brand,#0f766e)] text-white">
              <ShieldCheck className="size-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Presentar un reporte</h1>
            <p className="text-sm text-slate-600">{site ? site.name : "Organizacion no identificada"}</p>
          </div>
        </div>

        {enabled ? (
          <PublicReportForm />
        ) : (
          <div className="space-y-3">
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Esta organizacion no recibe reportes en linea por ahora.
            </p>
            <Link href="/" className="text-sm text-[var(--brand,#0f766e)] underline">Volver al inicio</Link>
          </div>
        )}
      </section>
    </main>
  );
}
