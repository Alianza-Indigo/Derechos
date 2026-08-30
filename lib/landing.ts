// Contenido de la landing page publica de cada organizacion. Se guarda como
// JSON en organizations.landing y lo edita el propio inquilino. Si no esta
// publicada, el sitio publico muestra una version minima (nombre + acceso).

export type LandingContent = {
  published: boolean;
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
};

export const emptyLanding: LandingContent = { published: false };

export function normalizeLanding(value: unknown): LandingContent {
  if (!value || typeof value !== "object") {
    return emptyLanding;
  }
  const v = value as Record<string, unknown>;
  const str = (key: string) => (typeof v[key] === "string" && v[key] ? (v[key] as string) : undefined);
  return {
    published: v.published === true,
    tagline: str("tagline"),
    about: str("about"),
    mission: str("mission"),
    heroImageUrl: str("heroImageUrl"),
    contactEmail: str("contactEmail"),
    contactPhone: str("contactPhone"),
    address: str("address"),
    website: str("website"),
    facebook: str("facebook"),
    instagram: str("instagram"),
    twitter: str("twitter"),
  };
}
