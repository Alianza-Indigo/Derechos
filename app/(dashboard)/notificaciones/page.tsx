import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { listNotifications } from "@/server/queries/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await listNotifications();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Avisos"
          description="Reportes nuevos y actividad relevante de tu organizacion. Al abrir un aviso llegas al caso relacionado."
        />
        <div className="px-4 pb-4">
          {notifications.length ? (
            <NotificationsList notifications={notifications} />
          ) : (
            <EmptyState title="Sin avisos" description="Aqui apareceran los reportes nuevos del publico y de miembros." />
          )}
        </div>
      </Card>
    </div>
  );
}
