import type { HumanRightsCase, RoleKey, User } from "@/lib/types";
import { stableUuid } from "@/lib/stable-id";

// Jerarquia territorial (hijo -> padre) cargada desde la base por peticion. Se
// usa para resolver el alcance por territorio sin cablear ninguna geografia.
let territoryParent = new Map<string, string | null>();

export function setTerritoryHierarchy(rows: Array<{ id: string; parentId: string | null }>) {
  territoryParent = new Map(rows.map((row) => [row.id, row.parentId ?? null]));
}

// Verdadero si `ancestor` es el propio `target` o alguno de sus ancestros por
// parentId. Tolera equivalencia id-legible/uuid (stableUuid) del demo/seed.
function isSelfOrAncestor(ancestor: string | undefined, target: string | undefined): boolean {
  if (!ancestor || !target) return false;
  let current: string | null | undefined = target;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (sameScope(ancestor, current)) return true;
    seen.add(current);
    current = territoryParent.get(current) ?? null;
  }
  return false;
}

const rolePermissions: Record<RoleKey, string[]> = {
  super_admin: ["*"],
  national_direction: ["read:national", "write:config", "approve", "audit", "ai:admin", "location:read", "reports:export"],
  state_coordination: ["read:territory", "write:territory", "location:read", "reports:export", "ai:use"],
  municipal_coordination: ["read:territory", "write:territory", "reports:export", "ai:use"],
  territorial_delegate: ["read:assigned", "write:field", "location:checkin", "ai:use"],
  field_commissioner: ["read:assigned", "write:field", "location:checkin", "ai:use"],
  case_manager: ["read:assigned", "write:case", "reports:export", "ai:use"],
  events_team: ["read:territory", "write:event", "reports:export", "ai:use"],
  data_entry: ["write:limited"],
  member: ["read:self"],
  auditor: ["read:audit", "reports:export"],
};

export function hasPermission(user: User, permission: string) {
  return user.roles.some((role) => rolePermissions[role]?.includes("*") || rolePermissions[role]?.includes(permission));
}

export function hasAnyPermission(user: User, permissions: string[]) {
  return permissions.some((permission) => hasPermission(user, permission));
}

// Puede ver datos personales sensibles (telefono, correo, domicilio, contacto).
export function canViewSensitive(user: User) {
  return hasAnyPermission(user, ["*", "read:national", "read:territory", "write:territory", "write:case", "read:audit", "audit"]);
}

export function canAccessTerritory(user: User, territoryId?: string) {
  if (hasPermission(user, "*") || user.roles.includes("super_admin") || user.roles.includes("national_direction")) {
    return true;
  }
  if (!territoryId) {
    return false;
  }
  // El usuario accede a su territorio y a todos sus descendientes (por parentId).
  return isSelfOrAncestor(user.territoryId, territoryId);
}

export function canAccessCase(user: User, record: HumanRightsCase) {
  if (canAccessTerritory(user, record.territoryId)) {
    return true;
  }
  return record.assignedTo === user.id || record.openedBy === user.id;
}

export function redactSensitive<T extends Record<string, unknown>>(value: T, allowSensitive: boolean) {
  if (allowSensitive) {
    return value;
  }
  const clone = { ...value };
  delete clone.phone;
  delete clone.email;
  delete clone.address;
  delete clone.evidence;
  delete clone.internalNotes;
  return clone;
}

function sameScope(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }
  return left === right || stableUuid(left) === right || stableUuid(right) === left;
}
