import { describe, expect, it } from "vitest";
import { credentialUrl } from "@/lib/qr";
import { aiProviderConfigs, aiPromptTemplates, members, organization } from "@/lib/seed-data";
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
    expect(canAccessTerritory({ id: "u", name: "Admin", email: "a@b.c", status: "active", roles: ["super_admin"] }, "cdj")).toBe(true);
    expect(canAccessTerritory({ id: "u", name: "Local", email: "l@b.c", status: "active", roles: ["municipal_coordination"], territoryId: "chc" }, "cdj")).toBe(false);
  });

  it("mantiene geolocalizacion e IA configurables", () => {
    expect(typeof organization.geolocationEnabled).toBe("boolean");
    expect(typeof organization.aiEnabled).toBe("boolean");
  });
});
