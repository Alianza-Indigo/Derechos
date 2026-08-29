import type { HumanRightsCase, RoleKey, User } from "@/lib/types";
import { stableUuid } from "@/lib/stable-id";

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

export function canAccessTerritory(user: User, territoryId?: string) {
  if (hasPermission(user, "*") || user.roles.includes("super_admin") || user.roles.includes("national_direction")) {
    return true;
  }
  if (!territoryId) {
    return false;
  }
  if (sameScope(user.territoryId, territoryId)) {
    return true;
  }
  if (sameScope(user.territoryId, "chh") && ["cdj", "chc"].some((child) => sameScope(child, territoryId))) {
    return true;
  }
  return false;
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
