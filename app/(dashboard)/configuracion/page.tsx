import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ResourceForm } from "@/components/forms/resource-form";
import { LocationSettingsEditor } from "@/components/config/location-settings-editor";
import { updateOrganizationAction } from "@/server/actions/platform";
import { getConfiguration, getCurrentUser, getUsers, getUserName } from "@/server/queries/app";
import { hasAnyPermission } from "@/server/permissions/rbac";

export default async function ConfigurationPage() {
  const data = await getConfiguration();
  const user = await getCurrentUser();
  const users = await getUsers();
  const canConfig = hasAnyPermission(user, ["write:config", "*"]);
  const labels = Object.fromEntries(users.map((item) => [item.id, item.name]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Configuracion institucional" description="Nombre, razon social, color, pais base, IA y geolocalizacion." />
        {canConfig ? (
          <ResourceForm
            submitLabel="Guardar configuracion"
            action={updateOrganizationAction}
            fields={[
              { name: "name", label: "Nombre publico", required: true, defaultValue: data.organization.name },
              { name: "legalName", label: "Razon social", defaultValue: data.organization.legalName },
              { name: "country", label: "Pais base", required: true, defaultValue: data.organization.country },
              { name: "primaryColor", label: "Color primario (#RRGGBB)", required: true, defaultValue: data.organization.primaryColor },
              { name: "geolocationEnabled", label: "Geolocalizacion", type: "checkbox", defaultChecked: data.organization.geolocationEnabled },
              { name: "aiEnabled", label: "Asistente IA", type: "checkbox", defaultChecked: data.organization.aiEnabled },
            ]}
          />
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
        <CardHeader title="Retencion y privacidad de ubicacion" description="Controla habilitacion, modo y retencion por usuario de campo." />
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
    </div>
  );
}
