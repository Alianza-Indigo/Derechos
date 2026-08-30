import { describe, expect, it } from "vitest";
import { credentialUrl } from "@/lib/qr";
import { rateLimit } from "@/lib/rate-limit";
import { stableUuid } from "@/lib/stable-id";
import { caseStatusUpdateSchema, providerConfigSchema } from "@/lib/validators";
import { aiProviderConfigs, aiPromptTemplates, members, organization } from "@/lib/mock-data";
import { canAccessTerritory } from "@/server/permissions/rbac";

describe("plataforma derechos humanos", () => {
  it("carga seed completo del PRD", () => {
    expect(members).toHaveLength(20);
    expect(aiPromptTemplates).toHaveLength(8);
    expect(aiProviderConfigs.map((provider) => provider.providerKey)).toEqual(["gemini", "openai", "anthropic"]);
  });

  it("crea URLs publicas de credencial sin datos sensibles", () => {
    expect(credentialUrl("demo")).toContain("/credencial/demo");
  });

  it("aplica alcance territorial basico", () => {
    expect(canAccessTerritory({ id: "u", organizationId: "org_demo", name: "Admin", email: "a@b.c", status: "active", roles: ["super_admin"] }, "cdj")).toBe(true);
    expect(canAccessTerritory({ id: "u", organizationId: "org_demo", name: "Local", email: "l@b.c", status: "active", roles: ["municipal_coordination"], territoryId: "chc" }, "cdj")).toBe(false);
  });

  it("mantiene geolocalizacion e IA configurables", () => {
    expect(typeof organization.geolocationEnabled).toBe("boolean");
    expect(typeof organization.aiEnabled).toBe("boolean");
  });

  it("exige motivo para cambios de estado de casos", () => {
    const result = caseStatusUpdateSchema.safeParse({ caseId: "case_1", status: "Resuelto", reason: "ok" });
    expect(result.success).toBe(false);
  });

  it("interpreta false textual como boolean false en configuracion de proveedores", () => {
    const result = providerConfigSchema.parse({
      providerKey: "openai",
      enabled: "false",
      defaultModel: "gpt-4.1-mini",
      priority: "2",
    });
    expect(result.enabled).toBe(false);
  });

  it("mantiene el alcance territorial estable con ids sembrados en DB", () => {
    const chihuahuaDbId = stableUuid("chh");
    expect(canAccessTerritory({ id: "u", organizationId: "org_demo", name: "Local", email: "l@b.c", status: "active", roles: ["municipal_coordination"], territoryId: chihuahuaDbId }, stableUuid("cdj"))).toBe(true);
  });

  it("aplica rate limit en memoria cuando KV no esta configurado", async () => {
    const key = `test:${crypto.randomUUID()}`;
    expect((await rateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await rateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await rateLimit(key, 2, 60)).allowed).toBe(false);
  });
});
