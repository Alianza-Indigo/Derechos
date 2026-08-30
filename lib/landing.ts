// Contenido de la landing page publica de cada organizacion. Se guarda como
// JSON en organizations.landing y lo edita el propio inquilino. Si no esta
// publicada, el sitio publico muestra una version minima (nombre + acceso).

export type TeamMember = { name: string; role?: string; photoUrl?: string };
export type NewsItem = { title: string; date?: string; body?: string; link?: string };
export type Achievement = { label: string; value?: string; description?: string };

export type LandingContent = {
  published: boolean;
  // Habilita el formulario publico de reportes/denuncias en la landing.
  acceptsPublicReports?: boolean;
  tagline?: string;
  about?: string;
  mission?: string;
  heroImageUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  // Secciones enriquecidas.
  team?: TeamMember[];
  news?: NewsItem[];
  achievements?: Achievement[];
};

// Topes por seccion (evitan payloads gigantes en el JSON).
export const LANDING_LIMITS = { team: 24, news: 20, achievements: 12 } as const;

export const emptyLanding: LandingContent = { published: false };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Solo admite URLs http(s); descarta esquemas peligrosos (javascript:, data:).
function asUrl(value: unknown): string | undefined {
  const s = asString(value);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

export function normalizeLanding(value: unknown): LandingContent {
  if (!value || typeof value !== "object") {
    return emptyLanding;
  }
  const v = value as Record<string, unknown>;
  const str = (key: string) => asString(v[key]);

  const team = asArray(v.team)
    .map((m) => ({ name: asString(m.name) ?? "", role: asString(m.role), photoUrl: asUrl(m.photoUrl) }))
    .filter((m) => m.name)
    .slice(0, LANDING_LIMITS.team);
  const news = asArray(v.news)
    .map((n) => ({ title: asString(n.title) ?? "", date: asString(n.date), body: asString(n.body), link: asUrl(n.link) }))
    .filter((n) => n.title)
    .slice(0, LANDING_LIMITS.news);
  const achievements = asArray(v.achievements)
    .map((a) => ({ label: asString(a.label) ?? "", value: asString(a.value), description: asString(a.description) }))
    .filter((a) => a.label)
    .slice(0, LANDING_LIMITS.achievements);

  return {
    published: v.published === true,
    acceptsPublicReports: v.acceptsPublicReports === true,
    tagline: str("tagline"),
    about: str("about"),
    mission: str("mission"),
    heroImageUrl: asUrl(v.heroImageUrl),
    contactEmail: str("contactEmail"),
    contactPhone: str("contactPhone"),
    address: str("address"),
    website: asUrl(v.website),
    facebook: asUrl(v.facebook),
    instagram: asUrl(v.instagram),
    twitter: asUrl(v.twitter),
    team: team.length ? team : undefined,
    news: news.length ? news : undefined,
    achievements: achievements.length ? achievements : undefined,
  };
}
