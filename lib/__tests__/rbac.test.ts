import { describe, expect, it } from "vitest";
import type { User } from "@/lib/types";
import { canAccessTerritory, canViewSensitive, hasAnyPermission, hasPermission, redactSensitive } from "@/server/permissions/rbac";

const make = (roles: User["roles"], territoryId?: string): User => ({
  id: "u",
  name: "Test",
  email: "t@demo.org",
  status: "active",
  roles,
  territoryId,
});

describe("rbac", () => {
  it("super_admin tiene todos los permisos", () => {
    const admin = make(["super_admin"]);
    expect(hasPermission(admin, "cualquier:cosa")).toBe(true);
    expect(canAccessTerritory(admin, "cdj")).toBe(true);
    expect(canViewSensitive(admin)).toBe(true);
  });

  it("respeta permisos por rol", () => {
    const captura = make(["data_entry"]);
    expect(hasPermission(captura, "write:limited")).toBe(true);
    expect(hasPermission(captura, "write:case")).toBe(false);
    expect(hasAnyPermission(captura, ["write:case", "write:limited"])).toBe(true);
  });

  it("alcance territorial jerarquico estatal -> municipal", () => {
    const estatal = make(["state_coordination"], "chh");
    expect(canAccessTerritory(estatal, "cdj")).toBe(true);
    expect(canAccessTerritory(estatal, "chc")).toBe(true);
    const municipal = make(["municipal_coordination"], "chc");
    expect(canAccessTerritory(municipal, "cdj")).toBe(false);
    expect(canAccessTerritory(municipal, "chc")).toBe(true);
  });

  it("data_entry no puede ver datos sensibles", () => {
    expect(canViewSensitive(make(["data_entry"]))).toBe(false);
    expect(canViewSensitive(make(["state_coordination"], "chh"))).toBe(true);
  });

  it("redactSensitive oculta campos personales cuando no hay permiso", () => {
    const record = { id: "1", fullName: "Ana", phone: "555", email: "a@b.c", address: "calle 1" };
    const redacted = redactSensitive(record, false);
    expect(redacted.phone).toBe("Reservado");
    expect(redacted.email).toBe("Reservado");
    expect(redacted.address).toBe("Reservado");
    expect(redacted.fullName).toBe("Ana");
    const clear = redactSensitive(record, true);
    expect(clear.phone).toBe("555");
  });
});
