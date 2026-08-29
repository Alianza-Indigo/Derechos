import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { CredentialManager } from "@/components/forms/credential-manager";
import { MemberAccessForm } from "@/components/forms/member-access";
import { MemberPhotoUploader } from "@/components/portal/photo-uploader";
import { credentialQrDataUrl, credentialUrl } from "@/lib/qr";
import { formatDate } from "@/lib/utils";
import { getCurrentUser, getMemberById, getTerritoryName } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

const credentialTone: Record<string, "green" | "amber" | "red" | "slate"> = {
  activa: "green",
  suspendida: "amber",
  revocada: "red",
  vencida: "slate",
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) notFound();
  const user = await getCurrentUser();
  const canManage = hasAnyPermission(user, ["write:territory", "*"]);
  const qr = await credentialQrDataUrl(member.credentialSlug);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader title="Credencial digital" description="Datos minimos para verificacion publica." />
        <div className="rounded-lg border border-slate-200 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR de credencial" className="mx-auto size-52" />
          <p className="mt-3 font-semibold">{member.fullName}</p>
          <p className="text-sm text-slate-600">{member.memberNumber}</p>
          <p className="mt-2 text-xs text-slate-500">{credentialUrl(member.credentialSlug)}</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm">
            <span className="text-slate-600">Estado:</span>
            <Badge tone={credentialTone[member.credentialStatus] ?? "slate"}>{member.credentialStatus}</Badge>
            {member.credentialExpiresAt ? <span className="text-xs text-slate-500">vence {formatDate(member.credentialExpiresAt)}</span> : null}
          </div>
        </div>
        {canManage ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Gestion de credencial</p>
            <CredentialManager memberId={member.id} status={member.credentialStatus} />
          </div>
        ) : null}
        {canManage ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Fotografia del miembro</p>
            <MemberPhotoUploader memberId={member.id} currentPhoto={member.photoUrl} />
          </div>
        ) : null}
        {canManage ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-1 text-sm font-medium text-slate-700">Acceso al portal del miembro</p>
            <p className="mb-2 text-xs text-slate-500">{member.userId ? "Este miembro ya puede iniciar sesion con su correo." : "Crea una contrasena para que el miembro entre al portal con su correo."}</p>
            <MemberAccessForm memberId={member.id} hasAccount={Boolean(member.userId)} />
          </div>
        ) : null}
      </Card>
      <Card>
        <CardHeader title="Perfil interno de miembro" description="Incluye datos sensibles solo para usuarios autorizados." />
        <DataTable headers={["Campo", "Valor"]}>
          <tr><td className="px-4 py-3 font-medium">Nombre</td><td className="px-4 py-3">{member.fullName}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Numero</td><td className="px-4 py-3">{member.memberNumber}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Estado</td><td className="px-4 py-3"><Badge tone="green">{member.status}</Badge></td></tr>
          <tr><td className="px-4 py-3 font-medium">Territorio</td><td className="px-4 py-3">{getTerritoryName(member.territoryId)}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Telefono</td><td className="px-4 py-3">{member.phone}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Correo</td><td className="px-4 py-3">{member.email}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Domicilio</td><td className="px-4 py-3">{member.address}</td></tr>
          <tr><td className="px-4 py-3 font-medium">Ingreso</td><td className="px-4 py-3">{formatDate(member.joinedAt)}</td></tr>
        </DataTable>
      </Card>
    </div>
  );
}
