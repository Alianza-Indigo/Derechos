import { describe, expect, it } from "vitest";
import type { User } from "@/lib/types";
import {
  canAccessCase,
  canAccessTerritory,
  canViewSensitive,
  hasAnyPermission,
  hasPermission,
} from "@/server/permissions/rbac";
import type { HumanRightsCase } from "@/lib/types";

const make = (roles: User["roles"], territoryId?: string): User => ({
  id: "u",
  organizationId: "org_demo",
  name: "Test",
  email: "t@demo.org",
  status: "active",
  roles,
  territoryId,
});

const caseAt = (territoryId: string, assignedTo = "x", openedBy = "y"): HumanRightsCase => ({
  id: "c",
  caseNumber: "CASO-1",
  title: "t",
  description: "d",
  category: "Otro",
  priority: "Media",
  status: "Nuevo",
  territoryId,
  openedBy,
  assignedTo,
  openedAt: "2026-01-01T00:00:00.000Z",
  persons: [],
  actions: [],
  evidence: [],
  internalNotes: [],
});

describe("rbac", () => {
  it("super_admin tiene todos los permisos y acceso", () => {
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
    expect(hasAnyPermission(captura, ["write:case", "ai:admin"])).toBe(false);
  });

  it("alcance territorial jerarquico estatal -> municipal", () => {
    const estatal = make(["state_coordination"], "chh");
    expect(canAccessTerritory(estatal, "cdj")).toBe(true);
    expect(canAccessTerritory(estatal, "chc")).toBe(true);
    const municipal = make(["municipal_coordination"], "chc");
    expect(canAccessTerritory(municipal, "chc")).toBe(true);
    expect(canAccessTerritory(municipal, "cdj")).toBe(false);
  });

  it("acceso a caso por territorio o asignacion", () => {
    const delegado = make(["case_manager"], "cdj");
    expect(canAccessCase(delegado, caseAt("cdj"))).toBe(true);
    expect(canAccessCase(delegado, caseAt("chc"))).toBe(false);
    expect(canAccessCase(make(["case_manager"], "chc"), caseAt("cdj", "u"))).toBe(true); // asignado
  });

  it("solo ciertos roles ven datos sensibles", () => {
    expect(canViewSensitive(make(["data_entry"]))).toBe(false);
    expect(canViewSensitive(make(["territorial_delegate"], "cdj"))).toBe(false);
    expect(canViewSensitive(make(["state_coordination"], "chh"))).toBe(true);
    expect(canViewSensitive(make(["auditor"]))).toBe(true);
  });
});
