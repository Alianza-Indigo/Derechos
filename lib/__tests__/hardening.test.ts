import { describe, expect, it } from "vitest";
import { intensityStyle } from "@/lib/intensity";
import { aiFeedbackSchema, caseReassignSchema, credentialActionSchema, locationPurgeSchema, memberAccessSchema, memberProfileSchema, memberReportSchema, roleAssignmentSchema, userFormSchema } from "@/lib/validators";

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

  it("valida el alta de usuario y su rol", () => {
    const ok = userFormSchema.safeParse({ name: "Ana Lopez", email: "ana@org.mx", password: "12345678", role: "case_manager" });
    expect(ok.success).toBe(true);
    expect(userFormSchema.safeParse({ name: "Ana", email: "ana@org.mx", password: "corta", role: "case_manager" }).success).toBe(false);
    expect(userFormSchema.safeParse({ name: "Ana Lopez", email: "ana@org.mx", password: "12345678", role: "rol_falso" }).success).toBe(false);
  });

  it("valida la asignacion de roles", () => {
    expect(roleAssignmentSchema.safeParse({ userId: "u1", role: "super_admin" }).success).toBe(true);
    expect(roleAssignmentSchema.safeParse({ userId: "u1", role: "state_coordination", territoryId: "t1" }).success).toBe(true);
    expect(roleAssignmentSchema.safeParse({ userId: "u1", role: "no_existe" }).success).toBe(false);
  });

  it("valida el reporte levantado por un miembro", () => {
    const ok = memberReportSchema.safeParse({ title: "Negacion de servicio", category: "Salud", description: "Me negaron atencion medica el dia de ayer en el hospital." });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.consentStatus).toBe("pendiente");
    expect(memberReportSchema.safeParse({ title: "x", category: "Salud", description: "corta" }).success).toBe(false);
    expect(memberReportSchema.safeParse({ title: "Motivo valido", category: "Inexistente", description: "Descripcion suficientemente larga para pasar." }).success).toBe(false);
  });

  it("valida el perfil del miembro y su acceso", () => {
    expect(memberProfileSchema.safeParse({ phone: "6141112233", email: "a@b.mx", address: "Calle 1" }).success).toBe(true);
    expect(memberProfileSchema.safeParse({ phone: "123", email: "no-mail", address: "x" }).success).toBe(false);
    expect(memberAccessSchema.safeParse({ memberId: "m1", password: "12345678" }).success).toBe(true);
    expect(memberAccessSchema.safeParse({ memberId: "m1", password: "corta" }).success).toBe(false);
    expect(caseReassignSchema.safeParse({ caseId: "c1", assignedTo: "u1" }).success).toBe(true);
  });
});
