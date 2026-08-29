import { Card, CardHeader } from "@/components/ui/card";
import { MemberProfileForm } from "@/components/portal/portal-forms";
import { MemberPhotoUploader } from "@/components/portal/photo-uploader";
import { getMemberSelf } from "@/server/queries/app";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const member = await getMemberSelf();
  if (!member) {
    return (
      <Card>
        <CardHeader title="Mis datos" description="Tu cuenta aun no esta vinculada a una ficha de miembro. Contacta a tu coordinacion." />
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Mi fotografia" description="Tu foto aparece en tu pagina de verificacion publica para comprobar tu identidad." />
        <MemberPhotoUploader proxyUrl={`/api/member-photo/${member.id}`} hasPhoto={Boolean(member.photoUrl)} />
      </Card>
      <Card>
        <CardHeader title="Mis datos de contacto" description="Manten actualizada tu informacion. Los cambios quedan registrados." />
        <MemberProfileForm profile={{ phone: member.phone, email: member.email, address: member.address }} />
      </Card>
    </div>
  );
}
