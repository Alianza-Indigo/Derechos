import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { aiProviderConfigs } from "@/drizzle/schema";
import { getDb } from "@/server/db";
import type { AiPromptTemplate } from "@/lib/types";

type RunAssistantInput = {
  prompt: AiPromptTemplate;
  message: string;
  context: Record<string, unknown>;
  // Tenant al que pertenece el prompt: acota la busqueda de proveedores IA.
  organizationId: string;
};

type ResolvedProvider = {
  key: "gemini" | "openai" | "anthropic";
  displayName: string;
  defaultModel: string;
  apiKey: string | null;
  enabled: boolean;
};

const blockedPatterns = [/fabric(a|ar).*evidencia/i, /ocult(a|ar).*evidencia/i, /alter(a|ar).*documento/i];

const ENV_BY_PROVIDER: Record<ResolvedProvider["key"], string> = {
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export async function runAssistant({ prompt, message, context, organizationId }: RunAssistantInput) {
  if (blockedPatterns.some((pattern) => pattern.test(message))) {
    return {
      output:
        "No puedo ayudar a ocultar, fabricar o alterar evidencia. Puedo ayudarte a ordenar los hechos reales y preparar un borrador revisable para personal autorizado.",
      provider: "policy",
      model: "safety-filter",
      status: "blocked",
      tokenUsage: {},
    };
  }

  const { selected, candidates } = await resolveProvider(prompt, organizationId);
  const keyFor = (p: ResolvedProvider) => p.apiKey || process.env[ENV_BY_PROVIDER[p.key]] || "";
  let active = selected;
  // Proveedor deshabilitado: no se ejecuta en modo simulado; se intenta un
  // proveedor habilitado por prioridad y, si no hay ninguno, se devuelve error.
  if (!selected.enabled) {
    const enabledAlternative = candidates.find((candidate) => candidate.enabled && keyFor(candidate));
    if (!enabledAlternative) {
      return {
        output: `El proveedor ${selected.displayName} esta deshabilitado y no hay otro proveedor habilitado con credenciales. Actívalo en Configuracion > IA o selecciona otro proveedor.`,
        provider: selected.key,
        model: selected.defaultModel,
        status: "disabled",
        tokenUsage: {},
      };
    }
    active = enabledAlternative;
  }
  let apiKey = keyFor(active);
  // Fallback por prioridad si el proveedor elegido no tiene credenciales.
  if (!apiKey && process.env.AI_ENABLE_PROVIDER_FALLBACK === "true") {
    const alternative = candidates.find((candidate) => candidate.enabled && candidate.key !== active.key && keyFor(candidate));
    if (alternative) {
      active = alternative;
      apiKey = keyFor(alternative);
    }
  }
  const selectedProvider = active;
  const contextText = JSON.stringify(context, null, 2).slice(0, 4000);
  const userPrompt = prompt.userPromptTemplate
    .replaceAll("{{contexto}}", contextText)
    .replaceAll("{{mensaje}}", message)
    .replaceAll("{{territorio}}", String(context.territorio ?? ""))
    .replaceAll("{{rol}}", String(context.rol ?? ""));

  if (!apiKey) {
    return {
      output: buildLocalDraft(prompt, message, selectedProvider.displayName),
      provider: selectedProvider.key,
      model: selectedProvider.defaultModel,
      status: "simulated",
      tokenUsage: { approximateInput: userPrompt.length / 4, approximateOutput: 220 },
    };
  }

  const model = getModel(selectedProvider.key, prompt.model || selectedProvider.defaultModel, apiKey);
  const result = await generateText({
    model,
    system: prompt.systemPrompt,
    prompt: userPrompt,
    temperature: prompt.temperature,
  });

  return {
    output: `${result.text}\n\nNota: este contenido es un borrador revisable; la decision final corresponde a personal autorizado.`,
    provider: selectedProvider.key,
    model: prompt.model || selectedProvider.defaultModel,
    status: "completed",
    tokenUsage: result.usage ?? {},
  };
}

function toResolved(config: typeof aiProviderConfigs.$inferSelect): ResolvedProvider {
  return {
    key: config.providerKey,
    displayName: config.displayName,
    defaultModel: config.defaultModel,
    apiKey: config.apiKey,
    enabled: config.enabled,
  };
}

async function resolveProvider(prompt: AiPromptTemplate, organizationId: string): Promise<{ selected: ResolvedProvider; candidates: ResolvedProvider[] }> {
  const db = getDb();
  // Solo proveedores de la organizacion (tenant) del prompt.
  const configs = await db
    .select()
    .from(aiProviderConfigs)
    .where(eq(aiProviderConfigs.organizationId, organizationId))
    .orderBy(aiProviderConfigs.priority);
  const candidates = configs.map(toResolved);
  const defaultProvider = (process.env.AI_DEFAULT_PROVIDER as ResolvedProvider["key"]) || "openai";
  const providerKey = prompt.providerKey === "global" ? defaultProvider : prompt.providerKey;
  const provider =
    configs.find((item) => item.providerKey === providerKey) ??
    configs.find((item) => item.providerKey === "openai") ??
    configs[0];

  if (!provider) {
    return {
      selected: { key: "openai", displayName: "ChatGPT/OpenAI", defaultModel: process.env.AI_DEFAULT_MODEL || "gpt-5-mini", apiKey: null, enabled: true },
      candidates,
    };
  }

  return { selected: toResolved(provider), candidates };
}

function getModel(provider: ResolvedProvider["key"], model: string, apiKey: string) {
  if (provider === "gemini") {
    return createGoogleGenerativeAI({ apiKey })(model);
  }
  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(model);
  }
  return createOpenAI({ apiKey })(model);
}

function buildLocalDraft(prompt: AiPromptTemplate, message: string, provider: string) {
  return [
    `Borrador institucional generado en modo local porque ${provider} no tiene credenciales activas.`,
    "",
    `Accion solicitada: ${prompt.name}.`,
    `Sintesis: ${message.slice(0, 500)}`,
    "",
    "Siguientes pasos sugeridos:",
    "1. Validar hechos, fechas, personas involucradas y consentimiento documentado.",
    "2. Separar datos sensibles de cualquier version publica o compartible.",
    "3. Registrar evidencia existente sin modificarla y anotar faltantes.",
    "4. Escalar a personal autorizado cuando exista riesgo, plazo cercano o posible dano irreparable.",
    "",
    "Nota: este contenido es un borrador revisable y no sustituye criterio humano ni autorizacion institucional.",
  ].join("\n");
}
