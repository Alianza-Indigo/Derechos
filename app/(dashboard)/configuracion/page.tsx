import { Card, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LocationPurgeForm, LocationSettingsEditor, OrganizationForm, TerritoryLocationEditor } from "@/components/config/config-forms";
import { getConfiguration, getCurrentUser, getTerritories, getUserName, getUsers } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";
import { planLabel, planLimits } from "@/lib/plans";

export default async function ConfigurationPage() {
  const data = await getConfiguration();
  const user = await getCurrentUser();
  const canConfig = hasAnyPermission(user, ["write:config", "*"]);
  const canPurgeLocation = canConfig && hasAnyPermission(user, ["location:read", "*"]);
  const users = await getUsers();
  const territories = await getTerritories();
  const labels = Object.fromEntries(users.map((item) => [item.id, item.name]));
  const plan = data.organization.plan ?? "institucional";
  const limits = planLimits(plan);
  const fmt = (value: number | null) => (value == null ? "sin limite" : String(value));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Plan" description="Plan comercial vigente y cupos de tu organizacion. Para cambiarlo contacta a la administracion de la plataforma." />
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <Badge tone="green">Plan {planLabel(plan)}</Badge>
          <span className="text-sm text-slate-600">Usuarios: {fmt(limits.maxUsers)}</span>
          <span className="text-sm text-slate-600">Miembros: {fmt(limits.maxMembers)}</span>
          <span className="text-sm text-slate-600">Casos: {fmt(limits.maxCases)}</span>
        </div>
      </Card>
      {canConfig ? (
        <Card>
          <CardHeader
            title="Administracion de usuarios y roles"
            description="Alta de usuarios, asignacion de roles por territorio y activacion de cuentas."
            action={<LinkButton href="/configuracion/usuarios">Administrar usuarios</LinkButton>}
          />
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Configuracion institucional" description="Nombre, razon social, logotipo, colores, pais base, IA y geolocalizacion." />
        {canConfig ? (
          <OrganizationForm organization={data.organization} />
        ) : (
          <DataTable headers={["Campo", "Valor"]}>
            <tr><td className="px-4 py-3 font-medium">Nombre publico</td><td className="px-4 py-3">{data.organization.name}</td></tr>
            <tr><td className="px-4 py-3 font-medium">Razon social</td><td className="px-4 py-3">{data.organization.legalName}</td></tr>
            <tr><td className="px-4 py-3 font-medium">Pais base</td><td className="px-4 py-3">{data.organization.country}</td></tr>
            <tr><td className="px-4 py-3 font-medium">Color primario</td><td className="px-4 py-3">{data.organization.primaryColor}</td></tr>
            <tr><td className="px-4 py-3 font-medium">Geolocalizacion</td><td className="px-4 py-3"><Badge tone={data.organization.geolocationEnabled ? "green" : "slate"}>{data.organization.geolocationEnabled ? "activa" : "deshabilitada"}</Badge></td></tr>
            <tr><td className="px-4 py-3 font-medium">Asistente IA</td><td className="px-4 py-3"><Badge tone={data.organization.aiEnabled ? "green" : "slate"}>{data.organization.aiEnabled ? "activo" : "deshabilitado"}</Badge></td></tr>
          </DataTable>
        )}
      </Card>
      <Card>
        <CardHeader title="Retencion y privacidad de ubicacion" description="Habilitacion, modo y retencion por usuario de campo." />
        {canConfig ? (
          <LocationSettingsEditor settings={data.locationSettings} labels={labels} />
        ) : (
          <DataTable headers={["Usuario", "Estado", "Modo", "Horario", "Retencion", "Actualizado por"]}>
            {data.locationSettings.map((setting) => (
              <tr key={setting.id}>
                <td className="px-4 py-3">{getUserName(setting.userId)}</td>
                <td className="px-4 py-3"><Badge tone={setting.enabled ? "green" : "amber"}>{setting.enabled ? "habilitada" : "pausada"}</Badge></td>
                <td className="px-4 py-3">{setting.mode}</td>
                <td className="px-4 py-3">{setting.allowedHours.from} - {setting.allowedHours.to}</td>
                <td className="px-4 py-3">{setting.retentionDays} dias</td>
                <td className="px-4 py-3">{getUserName(setting.updatedBy)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      <Card>
        <CardHeader title="Geolocalizacion por territorio" description="Habilita, define modo y retencion de ubicacion por pais, estado o ciudad." />
        {canConfig ? (
          <TerritoryLocationEditor settings={data.territorySettings} />
        ) : (
          <DataTable headers={["Territorio", "Estado", "Modo", "Retencion"]}>
            {data.territorySettings.map((setting) => (
              <tr key={setting.territoryId}>
                <td className="px-4 py-3">{setting.name}</td>
                <td className="px-4 py-3"><Badge tone={setting.enabled ? "green" : "slate"}>{setting.enabled ? "habilitada" : "deshabilitada"}</Badge></td>
                <td className="px-4 py-3">{setting.mode}</td>
                <td className="px-4 py-3">{setting.retentionDays} dias</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      {canPurgeLocation ? (
        <Card>
          <CardHeader title="Borrado de historial de ubicacion" description="Borrado administrativo manual conforme a la politica interna de retencion. Accion permanente y auditada." />
          <LocationPurgeForm territories={territories} users={users.map((item) => ({ id: item.id, name: item.name }))} />
        </Card>
      ) : null}
    </div>
  );
}
