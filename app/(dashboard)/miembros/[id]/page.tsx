import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { credentialQrDataUrl, credentialUrl } from "@/lib/qr";
import { formatDate } from "@/lib/utils";
import { getMemberById, getTerritoryName } from "@/server/queries/app";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) notFound();
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
        </div>
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
