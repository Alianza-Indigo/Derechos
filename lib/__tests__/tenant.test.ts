import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hostname, subdomainFromHost } from "@/lib/tenant";
import { isPlanKey, planLabel, planLimits } from "@/lib/plans";

describe("subdomainFromHost", () => {
  const original = process.env.ROOT_DOMAIN;
  beforeEach(() => {
    process.env.ROOT_DOMAIN = "derechos.org";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ROOT_DOMAIN;
    else process.env.ROOT_DOMAIN = original;
  });

  it("extrae el subdominio como slug del inquilino", () => {
    expect(subdomainFromHost("alianza.derechos.org")).toBe("alianza");
    expect(subdomainFromHost("alianza.derechos.org:3000")).toBe("alianza");
  });

  it("ignora el dominio raiz y www", () => {
    expect(subdomainFromHost("derechos.org")).toBeNull();
    expect(subdomainFromHost("www.derechos.org")).toBeNull();
  });

  it("devuelve null en hosts ajenos o vacios", () => {
    expect(subdomainFromHost("derechos-sigma.vercel.app")).toBeNull();
    expect(subdomainFromHost(null)).toBeNull();
  });

  it("sin ROOT_DOMAIN no resuelve subdominio", () => {
    delete process.env.ROOT_DOMAIN;
    expect(subdomainFromHost("alianza.derechos.org")).toBeNull();
  });
});

describe("hostname", () => {
  it("normaliza host quitando puerto y mayusculas", () => {
    expect(hostname("Derechos.ORG:443")).toBe("derechos.org");
    expect(hostname(undefined)).toBeNull();
  });
});

describe("planes", () => {
  it("expone cupos por plan y detecta claves validas", () => {
    expect(isPlanKey("gratuito")).toBe(true);
    expect(isPlanKey("inexistente")).toBe(false);
    expect(planLimits("gratuito").maxMembers).toBe(50);
    expect(planLimits("institucional").maxCases).toBeNull();
    expect(planLabel("pro")).toBe("Pro");
    // Clave desconocida cae al plan gratuito.
    expect(planLimits("xyz").maxUsers).toBe(3);
  });
});

describe("normalizeLanding secciones", () => {
  it("parsea y acota equipo/noticias/logros, descarta vacios", async () => {
    const { normalizeLanding, LANDING_LIMITS } = await import("@/lib/landing");
    const landing = normalizeLanding({
      published: true,
      team: [
        { name: "Ana", role: "Directora", photoUrl: "" },
        { name: "", role: "vacio" },
        ...Array.from({ length: 40 }, (_, i) => ({ name: `M${i}` })),
      ],
      news: [{ title: "Comunicado", date: "2026-08-01", body: "Texto", link: "https://x.org" }, { title: "" }],
      achievements: [{ label: "Casos", value: "1200" }, { value: "sin label" }],
    });
    // Ana + 40 M => acotado al maximo de equipo
    expect(landing.team?.length).toBe(LANDING_LIMITS.team);
    expect(landing.team?.[0]).toEqual({ name: "Ana", role: "Directora", photoUrl: undefined });
    expect(landing.news?.length).toBe(1);
    expect(landing.news?.[0].title).toBe("Comunicado");
    expect(landing.achievements?.length).toBe(1);
    expect(landing.achievements?.[0].label).toBe("Casos");
  });
});
