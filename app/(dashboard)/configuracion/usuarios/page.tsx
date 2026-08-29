import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { CreateUserForm, UserAdminTable } from "@/components/config/user-admin";
import { getCurrentUser, getTerritories, getUsersWithRoles } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

export default async function UsersAdminPage() {
  const user = await getCurrentUser();
  if (!hasAnyPermission(user, ["write:config", "*"])) {
    notFound();
  }
  const [users, territories] = await Promise.all([getUsersWithRoles(), getTerritories()]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Administracion de usuarios y roles"
          description="Alta de usuarios, asignacion de roles por territorio y activacion/desactivacion de cuentas. Cada cambio queda auditado."
          action={<Link href="/configuracion" className="text-sm text-teal-700 underline">Volver a configuracion</Link>}
        />
        <CreateUserForm territories={territories} />
      </Card>
      <Card>
        <CardHeader title="Usuarios" description="Roles vigentes y alcance por usuario." />
        {users.length ? (
          <UserAdminTable users={users} territories={territories} />
        ) : (
          <EmptyState title="Sin usuarios" description="Aun no hay usuarios registrados." />
        )}
      </Card>
    </div>
  );
}
