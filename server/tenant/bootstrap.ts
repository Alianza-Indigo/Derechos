import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { aiProviders } from "@/lib/constants";

// Codigos de pais frecuentes; si no se reconoce, se derivan 2 letras.
const COUNTRY_CODES: Record<string, string> = {
  mexico: "MX",
  méxico: "MX",
  colombia: "CO",
  argentina: "AR",
  chile: "CL",
  peru: "PE",
  perú: "PE",
  guatemala: "GT",
  honduras: "HN",
  espana: "ES",
  españa: "ES",
};

function countryCode(country: string): string {
  const key = country.trim().toLowerCase();
  return COUNTRY_CODES[key] ?? (country.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "XX");
}

// Siembra la configuracion base de una organizacion recien creada para que sea
// operativa desde el primer dia: un territorio raiz (pais), los proveedores de
// IA deshabilitados y un par de prompts base. Idempotente por onConflict.
export async function bootstrapOrganization(input: { organizationId: string; country: string; adminUserId: string }) {
  const db = getDb();
  const { organizationId, country, adminUserId } = input;

  // Territorio raiz (pais): necesario para casos, eventos y reportes publicos.
  await db
    .insert(schema.territories)
    .values({
      organizationId,
      type: "country",
      name: country,
      countryCode: countryCode(country),
      latitude: "0",
      longitude: "0",
      parentId: null,
    })
    .onConflictDoNothing();

  // Proveedores de IA (deshabilitados; el inquilino los activa y agrega su key).
  await db
    .insert(schema.aiProviderConfigs)
    .values(
      aiProviders.map((provider, index) => ({
        organizationId,
        providerKey: provider.key,
        displayName: provider.displayName,
        enabled: false,
        defaultModel: provider.defaultModel,
        encryptedApiKeyRef: "",
        priority: (index + 1) * 10,
        updatedBy: adminUserId,
      })),
    )
    .onConflictDoNothing();

  // Prompts base para que el asistente sea usable de inmediato.
  await db
    .insert(schema.aiPromptTemplates)
    .values([
      {
        organizationId,
        key: "asistente-general",
        name: "Asistente general",
        description: "Apoyo general para redaccion y sintesis institucional.",
        moduleScope: "general" as const,
        systemPrompt:
          "Eres un asistente para una organizacion de derechos humanos. Ayudas a ordenar hechos, redactar borradores claros y proponer siguientes pasos. Nunca ayudas a ocultar, fabricar o alterar evidencia. Todo output es un borrador revisable por personal autorizado.",
        userPromptTemplate: "Contexto:\n{{contexto}}\n\nSolicitud:\n{{mensaje}}",
        variables: ["contexto", "mensaje"],
        providerKey: "global" as const,
        temperature: "0.30",
        updatedBy: adminUserId,
      },
      {
        organizationId,
        key: "resumen-caso",
        name: "Resumen de caso",
        description: "Sintetiza un caso en puntos clave para seguimiento.",
        moduleScope: "caso" as const,
        systemPrompt:
          "Resumes casos de derechos humanos en puntos claros y accionables, separando hechos verificados de pendientes. No inventas datos. El resultado es un borrador revisable.",
        userPromptTemplate: "Caso:\n{{contexto}}\n\nInstruccion:\n{{mensaje}}",
        variables: ["contexto", "mensaje"],
        providerKey: "global" as const,
        temperature: "0.20",
        updatedBy: adminUserId,
      },
    ])
    .onConflictDoNothing();
}
