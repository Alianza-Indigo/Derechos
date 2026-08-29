import { Card, CardHeader } from "@/components/ui/card";
import { MemberReportForm } from "@/components/portal/portal-forms";

export const dynamic = "force-dynamic";

export default function PortalReportPage() {
  return (
    <Card>
      <CardHeader title="Levantar un reporte" description="Describe tu situacion. El equipo de la organizacion recibira tu reporte y le dara seguimiento." />
      <MemberReportForm />
    </Card>
  );
}
