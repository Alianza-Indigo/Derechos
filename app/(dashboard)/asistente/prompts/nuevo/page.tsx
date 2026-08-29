import { Card, CardHeader } from "@/components/ui/card";
import { ResourceForm } from "@/components/forms/resource-form";
import { promptScopes } from "@/lib/constants";
import { savePromptAction } from "@/server/actions/platform";

export default function NewPromptPage() {
  return (
    <Card>
      <CardHeader title="Crear prompt editable" description="Cada guardado crea version y queda en auditoria." />
      <ResourceForm
        action={savePromptAction}
        submitLabel="Guardar prompt"
        fields={[
          { name: "key", label: "Clave interna", required: true },
          { name: "name", label: "Nombre", required: true },
          { name: "moduleScope", label: "Modulo", type: "select", options: promptScopes.map((value) => ({ value, label: value })) },
          { name: "providerKey", label: "Proveedor", type: "select", options: ["global", "gemini", "openai", "anthropic"].map((value) => ({ value, label: value })) },
          { name: "model", label: "Modelo especifico opcional" },
          { name: "temperature", label: "Temperatura", type: "number", defaultValue: 0.3 },
          { name: "enabled", label: "Activo", type: "select", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Inactivo" }] },
          { name: "description", label: "Descripcion", type: "textarea", required: true },
          { name: "systemPrompt", label: "Prompt de sistema", type: "textarea", required: true },
          { name: "userPromptTemplate", label: "Plantilla de usuario", type: "textarea", required: true },
          { name: "variables", label: "Variables JSON", type: "textarea", defaultValue: "[\"contexto\",\"mensaje\"]", required: true },
        ]}
      />
    </Card>
  );
}
