"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import {
  organizationCreateSchema,
  organizationDetailsSchema,
  organizationDomainSchema,
  orgAdminPasswordSchema,
  organizationPlanSchema,
  organizationSignupSchema,
  organizationStatusSchema,
} from "@/lib/validators";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/queries/app";
import { isPlatformOwner } from "@/server/permissions/platform";
import { writeAuditLog } from "@/server/audit/log";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { bootstrapOrganization } from "@/server/tenant/bootstrap";

type ActionResult = { ok: boolean; message: string };

const DENIED: ActionResult = { ok: false, message: "Solo la administracion de la plataforma puede gestionar organizaciones." };

// Alta de una organizacion (inquilino) y su primer administrador. Solo la
// duena de la plataforma. La organizacion nace activa y con su super_admin
// de alcance global; a partir de ahi el propio inquilino se autoadministra.
export async function createOrganizationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = organizationCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const data = parsed.data;
  const slug = data.slug.toLowerCase();
  const code = data.code.toUpperCase();
  const adminEmail = data.adminEmail.toLowerCase().trim();
  const db = getDb();

  // Slug y codigo son unicos en toda la plataforma.
  const clash = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, slug))
    .limit(1);
  if (clash.length) {
    return { ok: false, message: "Ya existe una organizacion con ese identificador (slug)." };
  }
  const codeClash = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.code, code))
    .limit(1);
  if (codeClash.length) {
    return { ok: false, message: "Ya existe una organizacion con ese codigo." };
  }

  const orgId = crypto.randomUUID();
  await db.insert(schema.organizations).values({
    id: orgId,
    name: data.name,
    legalName: data.legalName || null,
    slug,
    code,
    country: data.country,
    primaryColor: data.primaryColor || "#0f766e",
    plan: data.plan || "institucional",
    status: "active",
  });

  const userId = crypto.randomUUID();
  const passwordHash = await hash(data.adminPassword, 12);
  await db.insert(schema.users).values({
    id: userId,
    organizationId: orgId,
    name: data.adminName,
    email: adminEmail,
    passwordHash,
    providerId: null,
    status: "active",
  });

  const [superRole] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.key, "super_admin")).limit(1);
  if (superRole) {
    await db.insert(schema.userRoles).values({
      organizationId: orgId,
      userId,
      roleId: superRole.id,
      scopeType: "global",
      scopeId: null,
    });
  }

  // Configuracion base operativa (territorio raiz, proveedores IA, prompts).
  await bootstrapOrganization({ organizationId: orgId, country: data.country, adminUserId: userId });

  await writeAuditLog({
    actorId: actor.id,
    organizationId: orgId,
    action: "organization.create",
    entityType: "organization",
    entityId: orgId,
    after: { name: data.name, slug, code, adminEmail },
  });
  revalidatePath("/plataforma");
  return { ok: true, message: `Organizacion "${data.name}" creada. El administrador ya puede iniciar sesion con ${adminEmail}.` };
}

// Suspende o reactiva una organizacion. Una organizacion suspendida bloquea el
// acceso de todos sus usuarios. La duena no puede suspender su propia
// organizacion (evita autobloqueo).
export async function setOrganizationStatusAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = organizationStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  if (parsed.data.status === "suspended" && parsed.data.organizationId === actor.organizationId) {
    return { ok: false, message: "No puedes suspender tu propia organizacion." };
  }
  const db = getDb();
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, parsed.data.organizationId)).limit(1);
  if (!org) {
    return { ok: false, message: "La organizacion no existe." };
  }
  await db.update(schema.organizations).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(schema.organizations.id, parsed.data.organizationId));
  await writeAuditLog({
    actorId: actor.id,
    organizationId: parsed.data.organizationId,
    action: parsed.data.status === "suspended" ? "organization.suspend" : "organization.activate",
    entityType: "organization",
    entityId: parsed.data.organizationId,
    before: { status: org.status },
    after: { status: parsed.data.status },
  });
  revalidatePath("/plataforma");
  return { ok: true, message: parsed.data.status === "suspended" ? "Organizacion suspendida." : "Organizacion activada." };
}

// Cambia el plan comercial de una organizacion (define sus cupos). Solo la
// duena de la plataforma.
export async function setOrganizationPlanAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = organizationPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const [org] = await db.select({ plan: schema.organizations.plan }).from(schema.organizations).where(eq(schema.organizations.id, parsed.data.organizationId)).limit(1);
  if (!org) {
    return { ok: false, message: "La organizacion no existe." };
  }
  await db.update(schema.organizations).set({ plan: parsed.data.plan, updatedAt: new Date() }).where(eq(schema.organizations.id, parsed.data.organizationId));
  await writeAuditLog({
    actorId: actor.id,
    organizationId: parsed.data.organizationId,
    action: "organization.plan_change",
    entityType: "organization",
    entityId: parsed.data.organizationId,
    before: { plan: org.plan },
    after: { plan: parsed.data.plan },
  });
  revalidatePath("/plataforma");
  return { ok: true, message: "Plan actualizado." };
}

// Define o limpia el dominio propio de una organizacion. Solo la duena de la
// plataforma. El dominio es unico en toda la plataforma.
export async function setOrganizationDomainAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = organizationDomainSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const domain = parsed.data.customDomain?.trim().toLowerCase() || null;
  const db = getDb();
  if (domain) {
    const clash = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.customDomain, domain))
      .limit(1);
    if (clash.length && clash[0].id !== parsed.data.organizationId) {
      return { ok: false, message: "Ese dominio ya esta asignado a otra organizacion." };
    }
  }
  await db.update(schema.organizations).set({ customDomain: domain, updatedAt: new Date() }).where(eq(schema.organizations.id, parsed.data.organizationId));
  await writeAuditLog({
    actorId: actor.id,
    organizationId: parsed.data.organizationId,
    action: "organization.domain_set",
    entityType: "organization",
    entityId: parsed.data.organizationId,
    after: { customDomain: domain },
  });
  revalidatePath("/plataforma");
  return { ok: true, message: domain ? "Dominio propio configurado. Apunta el DNS y agregalo en tu hosting." : "Dominio propio removido." };
}

// La duena de la plataforma edita datos basicos de cualquier organizacion.
export async function updateOrganizationDetailsAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = organizationDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const [org] = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.id, parsed.data.organizationId)).limit(1);
  if (!org) {
    return { ok: false, message: "La organizacion no existe." };
  }
  await db
    .update(schema.organizations)
    .set({
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      country: parsed.data.country,
      primaryColor: parsed.data.primaryColor,
      updatedAt: new Date(),
    })
    .where(eq(schema.organizations.id, parsed.data.organizationId));
  await writeAuditLog({
    actorId: actor.id,
    organizationId: parsed.data.organizationId,
    action: "organization.details_update",
    entityType: "organization",
    entityId: parsed.data.organizationId,
    after: { name: parsed.data.name, country: parsed.data.country },
  });
  revalidatePath(`/plataforma/${parsed.data.organizationId}`);
  revalidatePath("/plataforma");
  return { ok: true, message: "Datos de la organizacion actualizados." };
}

// La duena de la plataforma restablece la contrasena de un usuario (admin) de
// una organizacion, util para recuperar acceso de un inquilino.
export async function resetOrgAdminPasswordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentUser();
  if (!isPlatformOwner(actor)) {
    return DENIED;
  }
  const parsed = orgAdminPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const db = getDb();
  const [target] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, parsed.data.userId), eq(schema.users.organizationId, parsed.data.organizationId)))
    .limit(1);
  if (!target) {
    return { ok: false, message: "El usuario no pertenece a esa organizacion." };
  }
  const passwordHash = await hash(parsed.data.password, 12);
  await db.update(schema.users).set({ passwordHash, status: "active", updatedAt: new Date() }).where(eq(schema.users.id, parsed.data.userId));
  await writeAuditLog({
    actorId: actor.id,
    organizationId: parsed.data.organizationId,
    action: "organization.admin_password_reset",
    entityType: "user",
    entityId: parsed.data.userId,
  });
  revalidatePath(`/plataforma/${parsed.data.organizationId}`);
  return { ok: true, message: "Contrasena restablecida. Comparte la nueva credencial de forma segura." };
}

// Auto-registro publico de una organizacion. Crea la organizacion en estado
// "pending" (pendiente de aprobacion) y su primer administrador. No requiere
// sesion; limitado por IP. Hasta que la plataforma la apruebe, sus usuarios no
// pueden iniciar sesion (el gate de organizacion inactiva los bloquea).
export async function registerOrganizationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = await rateLimit(`signup:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return { ok: false, message: "Demasiados registros desde esta red. Intenta mas tarde." };
  }
  const parsed = organizationSignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos invalidos." };
  }
  const data = parsed.data;
  const db = getDb();

  const slugClash = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.slug, data.slug)).limit(1);
  if (slugClash.length) {
    return { ok: false, message: "Ya existe una organizacion con ese identificador (slug). Elige otro." };
  }
  const codeClash = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.code, data.code)).limit(1);
  if (codeClash.length) {
    return { ok: false, message: "Ya existe una organizacion con ese codigo. Elige otro." };
  }

  const orgId = crypto.randomUUID();
  await db.insert(schema.organizations).values({
    id: orgId,
    name: data.name,
    legalName: data.legalName || null,
    slug: data.slug,
    code: data.code,
    country: data.country,
    plan: "gratuito",
    status: "pending",
  });

  const userId = crypto.randomUUID();
  const passwordHash = await hash(data.adminPassword, 12);
  await db.insert(schema.users).values({
    id: userId,
    organizationId: orgId,
    name: data.adminName,
    email: data.adminEmail.toLowerCase().trim(),
    passwordHash,
    providerId: null,
    status: "active",
  });
  const [superRole] = await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.key, "super_admin")).limit(1);
  if (superRole) {
    await db.insert(schema.userRoles).values({ organizationId: orgId, userId, roleId: superRole.id, scopeType: "global", scopeId: null });
  }

  // Configuracion base operativa para que la org sea usable al aprobarse.
  await bootstrapOrganization({ organizationId: orgId, country: data.country, adminUserId: userId });

  await writeAuditLog({
    organizationId: orgId,
    action: "organization.signup",
    entityType: "organization",
    entityId: orgId,
    after: { name: data.name, slug: data.slug, code: data.code },
    ip: ip === "local" ? undefined : ip,
  });
  return { ok: true, message: "Registro recibido. Tu organizacion quedara activa cuando la plataforma la apruebe; te avisaremos." };
}
