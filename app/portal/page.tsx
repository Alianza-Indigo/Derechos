import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { credentialQrDataUrl, credentialUrl } from "@/lib/qr";
import { formatDate } from "@/lib/utils";
import { resolveBaseUrl } from "@/server/base-url";
import { getMemberSelf, getMyReports } from "@/server/queries/app";

const credentialTone: Record<string, "green" | "amber" | "red" | "slate"> = {
  activa: "green",
  suspendida: "amber",
  revocada: "red",
  vencida: "slate",
};

export default async function PortalHomePage() {
  const member = await getMemberSelf();
  const reports = await getMyReports();
  const baseUrl = await resolveBaseUrl();
  const qr = member?.credentialSlug ? await credentialQrDataUrl(member.credentialSlug, baseUrl) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={`Hola, ${member?.fullName ?? "miembro"}`} description="Desde aqui puedes levantar un reporte, darle seguimiento y consultar tu credencial." />
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/portal/reporte">Levantar un reporte</LinkButton>
          <LinkButton href="/portal/mis-reportes" variant="secondary">Ver mis reportes</LinkButton>
        </div>
      </Card>

      {member ? (
        <Card>
          <CardHeader title="Mi credencial digital" description="Datos minimos para verificacion. No expone tus datos sensibles." />
          <div className="flex flex-wrap items-center gap-6">
            {qr ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR de credencial" className="size-40" />
                <a href={qr} download={`credencial-${member.memberNumber}.png`} className="mt-2 inline-block text-xs text-teal-700 underline">Descargar QR</a>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aun no tienes una credencial emitida. Solicítala a tu coordinacion.</p>
            )}
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/member-photo/${member.id}`} alt="Mi fotografia" className="size-24 rounded-lg border border-slate-200 object-cover" />
            ) : null}
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-slate-900">{member.fullName}</p>
              <p className="text-slate-600">{member.memberNumber}</p>
              <p className="flex items-center gap-2">Estado: <Badge tone={credentialTone[member.credentialStatus] ?? "slate"}>{member.credentialStatus}</Badge></p>
              {member.credentialExpiresAt ? <p className="text-xs text-slate-500">Vigencia: {formatDate(member.credentialExpiresAt)}</p> : null}
              {member.credentialSlug ? <p className="text-xs text-slate-500">Verificacion publica: {credentialUrl(member.credentialSlug, baseUrl)}</p> : null}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Sin ficha de miembro" description="Tu cuenta aun no esta vinculada a una ficha de miembro. Contacta a tu coordinacion." />
        </Card>
      )}

      <Card>
        <CardHeader title="Mis reportes recientes" action={<Link href="/portal/mis-reportes" className="text-sm text-teal-700 underline">Ver todos</Link>} />
        {reports.length ? (
          <ul className="divide-y divide-slate-100">
            {reports.slice(0, 5).map((report) => (
              <li key={report.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{report.title}</p>
                  <p className="text-xs text-slate-500">{report.caseNumber} · {formatDate(report.openedAt)}</p>
                </div>
                <Badge tone={report.status === "Resuelto" ? "green" : report.status === "Nuevo" ? "amber" : "blue"}>{report.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Todavia no has levantado ningun reporte.</p>
        )}
      </Card>
    </div>
  );
}
