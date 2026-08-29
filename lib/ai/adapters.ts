import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { aiProviderConfigs } from "@/lib/mock-data";
import type { AiPromptTemplate } from "@/lib/types";

type RunAssistantInput = {
  prompt: AiPromptTemplate;
  message: string;
  context: Record<string, unknown>;
};

const blockedPatterns = [/fabric(a|ar).*evidencia/i, /ocult(a|ar).*evidencia/i, /alter(a|ar).*documento/i];

export async function runAssistant({ prompt, message, context }: RunAssistantInput) {
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

  const selected = resolveProvider(prompt);
  const contextText = JSON.stringify(context, null, 2).slice(0, 4000);
  const userPrompt = prompt.userPromptTemplate
    .replaceAll("{{contexto}}", contextText)
    .replaceAll("{{mensaje}}", message)
    .replaceAll("{{territorio}}", String(context.territorio ?? ""))
    .replaceAll("{{rol}}", String(context.rol ?? ""));

  if (!selected.enabled || !process.env[selected.env]) {
    return {
      output: buildLocalDraft(prompt, message, selected.displayName),
      provider: selected.key,
      model: selected.defaultModel,
      status: "simulated",
      tokenUsage: { approximateInput: userPrompt.length / 4, approximateOutput: 220 },
    };
  }

  const model = getModel(selected.key, prompt.model || selected.defaultModel);
  const result = await generateText({
    model,
    system: prompt.systemPrompt,
    prompt: userPrompt,
    temperature: prompt.temperature,
  });

  return {
    output: `${result.text}\n\nNota: este contenido es un borrador revisable; la decision final corresponde a personal autorizado.`,
    provider: selected.key,
    model: prompt.model || selected.defaultModel,
    status: "completed",
    tokenUsage: result.usage ?? {},
  };
}

function resolveProvider(prompt: AiPromptTemplate) {
  const defaultProvider = process.env.AI_DEFAULT_PROVIDER || "openai";
  const providerKey = prompt.providerKey === "global" ? defaultProvider : prompt.providerKey;
  const provider = aiProviderConfigs.find((item) => item.providerKey === providerKey) ?? aiProviderConfigs[1];
  const env = provider.providerKey === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : provider.providerKey === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  return { ...provider, key: provider.providerKey, env };
}

function getModel(provider: string, model: string) {
  if (provider === "gemini") {
    return google(model);
  }
  if (provider === "anthropic") {
    return anthropic(model);
  }
  return openai(model);
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
