import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { hostname, subdomainFromHost } from "@/lib/tenant";
import { normalizeLanding, type LandingContent } from "@/lib/landing";

export type TenantBranding = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  code: string;
  slug: string;
};

function toBranding(row: {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  code: string;
  slug: string;
}): TenantBranding {
  return row;
}

const brandingColumns = {
  id: schema.organizations.id,
  name: schema.organizations.name,
  logoUrl: schema.organizations.logoUrl,
  primaryColor: schema.organizations.primaryColor,
  code: schema.organizations.code,
  slug: schema.organizations.slug,
  status: schema.organizations.status,
};

// Resuelve el inquilino a partir del host de la peticion (dominio propio exacto
// o subdominio = slug). Solo devuelve inquilinos activos, para no revelar la
// identidad de una organizacion suspendida o pendiente. Uso en paginas publicas
// (login) para tematizar y acotar el acceso.
export async function resolveTenantFromHeaders(): Promise<TenantBranding | null> {
  const headerList = await headers();
  const host = headerList.get("host");
  const name = hostname(host);
  if (!name) {
    return null;
  }
  const db = getDb();

  const [byDomain] = await db.select(brandingColumns).from(schema.organizations).where(eq(schema.organizations.customDomain, name)).limit(1);
  if (byDomain && byDomain.status === "active") {
    return toBranding(byDomain);
  }

  const slug = subdomainFromHost(host);
  if (slug) {
    const [bySlug] = await db.select(brandingColumns).from(schema.organizations).where(eq(schema.organizations.slug, slug)).limit(1);
    if (bySlug && bySlug.status === "active") {
      return toBranding(bySlug);
    }
  }
  return null;
}

// Branding de la organizacion de un usuario ya autenticado (para el panel).
export async function getOrganizationBranding(organizationId: string): Promise<TenantBranding | null> {
  const db = getDb();
  const [row] = await db.select(brandingColumns).from(schema.organizations).where(eq(schema.organizations.id, organizationId)).limit(1);
  return row ? toBranding(row) : null;
}

export type PublicSite = {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  slug: string;
  code: string;
  country: string;
  landing: LandingContent;
};

const siteColumns = {
  id: schema.organizations.id,
  name: schema.organizations.name,
  legalName: schema.organizations.legalName,
  logoUrl: schema.organizations.logoUrl,
  primaryColor: schema.organizations.primaryColor,
  slug: schema.organizations.slug,
  code: schema.organizations.code,
  country: schema.organizations.country,
  status: schema.organizations.status,
  landing: schema.organizations.landing,
};

function toSite(row: {
  id: string;
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  slug: string;
  code: string;
  country: string;
  landing: LandingContent | null;
}): PublicSite {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    slug: row.slug,
    code: row.code,
    country: row.country,
    landing: normalizeLanding(row.landing),
  };
}

// Sitio publico (landing) del inquilino resuelto por el host. Solo inquilinos
// activos. Devuelve null si el host no corresponde a ningun inquilino (p. ej.
// el dominio comun de la plataforma).
export async function getPublicSiteFromHeaders(): Promise<PublicSite | null> {
  const headerList = await headers();
  const host = headerList.get("host");
  const name = hostname(host);
  if (!name) {
    return null;
  }
  const db = getDb();

  const [byDomain] = await db.select(siteColumns).from(schema.organizations).where(eq(schema.organizations.customDomain, name)).limit(1);
  if (byDomain && byDomain.status === "active") {
    return toSite(byDomain);
  }

  const slug = subdomainFromHost(host);
  if (slug) {
    const [bySlug] = await db.select(siteColumns).from(schema.organizations).where(eq(schema.organizations.slug, slug)).limit(1);
    if (bySlug && bySlug.status === "active") {
      return toSite(bySlug);
    }
  }
  return null;
}
