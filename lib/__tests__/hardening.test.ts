import { describe, expect, it } from "vitest";
import { intensityStyle } from "@/lib/intensity";
import { aiFeedbackSchema, credentialActionSchema, locationPurgeSchema } from "@/lib/validators";

describe("endurecimiento del review", () => {
  it("escala la intensidad del mapa por valor y maximo", () => {
    const zero = intensityStyle(0, 100);
    expect(zero.ratio).toBe(0);
    expect(zero.radius).toBe(8);

    const full = intensityStyle(100, 100);
    expect(full.ratio).toBe(1);
    expect(full.radius).toBeGreaterThan(zero.radius);
    expect(full.fillOpacity).toBeGreaterThan(zero.fillOpacity);
  });

  it("evita division por cero cuando el maximo es 0", () => {
    const style = intensityStyle(5, 0);
    expect(Number.isFinite(style.ratio)).toBe(true);
    expect(style.ratio).toBe(1);
  });

  it("valida la calificacion de IA entre 1 y 5", () => {
    expect(aiFeedbackSchema.safeParse({ aiRunId: "run_1", rating: "4" }).success).toBe(true);
    expect(aiFeedbackSchema.safeParse({ aiRunId: "run_1", rating: "9" }).success).toBe(false);
    expect(aiFeedbackSchema.safeParse({ aiRunId: "", rating: "3" }).success).toBe(false);
  });

  it("acepta solo acciones validas de credencial", () => {
    expect(credentialActionSchema.safeParse({ memberId: "m1", action: "revoke" }).success).toBe(true);
    expect(credentialActionSchema.safeParse({ memberId: "m1", action: "renew" }).success).toBe(true);
    expect(credentialActionSchema.safeParse({ memberId: "m1", action: "borrar" }).success).toBe(false);
  });

  it("valida el alcance de purga de ubicacion", () => {
    expect(locationPurgeSchema.safeParse({ scope: "all" }).success).toBe(true);
    expect(locationPurgeSchema.safeParse({ scope: "territory", territoryId: "t1" }).success).toBe(true);
    expect(locationPurgeSchema.safeParse({ scope: "invalid" }).success).toBe(false);
  });
});
