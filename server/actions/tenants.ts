"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { organizationCreateSchema, organizationStatusSchema } from "@/lib/validators";
import { getDb } from "@/server/db";
import { getCurrentUser } from "@/server/queries/app";
import { isPlatformOwner } from "@/server/permissions/platform";
import { writeAuditLog } from "@/server/audit/log";

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
  return { ok: true, message: parsed.data.status === "suspended" ? "Organizacion suspendida." : "Organizacion reactivada." };
}
