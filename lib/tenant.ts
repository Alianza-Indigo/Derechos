// Resuelve el subdominio del inquilino a partir del host, usando ROOT_DOMAIN.
// Ej. con ROOT_DOMAIN="derechos.org", host "alianza.derechos.org" -> "alianza".
// En el dominio raiz, "www", o sin ROOT_DOMAIN configurado, devuelve null (no
// hay inquilino por subdominio; se usa el comportamiento por defecto).
export function subdomainFromHost(host: string | null | undefined): string | null {
  if (!host) {
    return null;
  }
  const hostname = host.split(":")[0].trim().toLowerCase();
  const root = process.env.ROOT_DOMAIN?.trim().toLowerCase();
  if (!root || hostname === root || hostname === `www.${root}`) {
    return null;
  }
  if (hostname.endsWith(`.${root}`)) {
    const label = hostname.slice(0, hostname.length - root.length - 1);
    const first = label.split(".")[0];
    return first || null;
  }
  return null;
}

// Normaliza un host a su nombre (sin puerto, en minusculas) para comparar con
// el dominio propio de un inquilino.
export function hostname(host: string | null | undefined): string | null {
  if (!host) {
    return null;
  }
  return host.split(":")[0].trim().toLowerCase() || null;
}
