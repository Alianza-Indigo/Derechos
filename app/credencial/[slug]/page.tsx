import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { credentialQrDataUrl } from "@/lib/qr";
import { formatDate } from "@/lib/utils";
import { logCredentialVerification } from "@/server/audit/credential";
import { resolveBaseUrl } from "@/server/base-url";
import { getMemberByCredentialSlug, getTerritoryName } from "@/server/queries/app";

export default async function CredentialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await getMemberByCredentialSlug(slug);
  if (!member) notFound();
  const requestHeaders = await headers();
  await logCredentialVerification({
    publicSlug: slug,
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: requestHeaders.get("user-agent"),
  });
  const qr = await credentialQrDataUrl(slug, await resolveBaseUrl());

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader title="Verificacion publica de credencial" description="Esta vista no expone telefono, correo, domicilio, casos, documentos ni ubicaciones." />
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-teal-700 font-bold text-white">DH</div>
          <p className="text-sm text-slate-500">{APP_NAME}</p>
          {member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/member-photo/${member.id}`} alt={`Fotografia de ${member.fullName}`} className="mx-auto mt-4 size-28 rounded-full border border-slate-200 object-cover" />
          ) : null}
          <h1 className="mt-2 text-xl font-semibold text-slate-950">{member.fullName}</h1>
          <p className="mt-1 text-slate-600">{member.memberNumber}</p>
          <div className="mt-4"><Badge tone={member.credentialStatus === "activa" ? "green" : "amber"}>{member.credentialStatus}</Badge></div>
          <p className="mt-3 text-sm text-slate-600">{getTerritoryName(member.territoryId)}</p>
          <p className="mt-1 text-xs text-slate-500">Vigencia: {formatDate(member.credentialExpiresAt)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR de verificacion" className="mx-auto mt-5 size-40" />
        </div>
      </Card>
    </main>
  );
}
