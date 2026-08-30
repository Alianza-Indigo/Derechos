import { Card, CardHeader } from "@/components/ui/card";
import { CaseIntakeForm } from "@/components/forms/case-intake-form";
import { caseCategories, caseStatuses, priorities } from "@/lib/constants";
import { getTerritories, getUsers } from "@/server/queries/app";

export default async function NewCasePage() {
  const [territories, users] = await Promise.all([getTerritories(), getUsers()]);
  return (
    <Card>
      <CardHeader title="Formato de admision de caso" description="Captura los datos del caso, los hechos, la persona afectada, quien reporta y la autoridad senalada. El cambio de estado y el seguimiento quedan auditados." />
      <CaseIntakeForm
        territories={territories.map((t) => ({ value: t.id, label: t.name }))}
        users={users.map((u) => ({ value: u.id, label: u.name }))}
        categories={caseCategories}
        priorities={priorities}
        statuses={caseStatuses}
      />
    </Card>
  );
}
