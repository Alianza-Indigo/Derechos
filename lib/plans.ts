// Planes comerciales por inquilino. Los cupos se aplican al crear usuarios,
// miembros y casos. `null` significa sin limite. Los limites viven en codigo
// (no en la base) para poder ajustarlos sin migraciones; la organizacion solo
// guarda la clave del plan.

export type PlanKey = "gratuito" | "pro" | "institucional";

export type PlanLimits = {
  maxUsers: number | null;
  maxMembers: number | null;
  maxCases: number | null;
};

export const PLANS: Record<PlanKey, { label: string; limits: PlanLimits }> = {
  gratuito: {
    label: "Gratuito",
    limits: { maxUsers: 3, maxMembers: 50, maxCases: 100 },
  },
  pro: {
    label: "Pro",
    limits: { maxUsers: 15, maxMembers: 500, maxCases: 2000 },
  },
  institucional: {
    label: "Institucional",
    limits: { maxUsers: null, maxMembers: null, maxCases: null },
  },
};

export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

export function isPlanKey(value: string): value is PlanKey {
  return value in PLANS;
}

export function planLimits(plan: string): PlanLimits {
  return isPlanKey(plan) ? PLANS[plan].limits : PLANS.gratuito.limits;
}

export function planLabel(plan: string): string {
  return isPlanKey(plan) ? PLANS[plan].label : plan;
}
