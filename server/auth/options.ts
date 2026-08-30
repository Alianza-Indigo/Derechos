import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import CredentialsProvider from "next-auth/providers/credentials";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/server/audit/log";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales institucionales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contrasena", type: "password" },
        orgCode: { label: "Codigo de organizacion", type: "text" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        const orgCode = credentials?.orgCode?.toUpperCase().trim();
        if (!email || !password) {
          return null;
        }
        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
        const limit = await rateLimit(`login:${forwarded || "local"}`, 8, 60);
        if (!limit.allowed) {
          return null;
        }
        const db = getDb();
        // Un correo puede repetirse entre organizaciones (unico por-inquilino).
        // Se traen todos los candidatos con el estado de su organizacion; si el
        // usuario indico un codigo de organizacion se filtra por el.
        const rows = await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            passwordHash: schema.users.passwordHash,
            status: schema.users.status,
            orgStatus: schema.organizations.status,
            orgCode: schema.organizations.code,
          })
          .from(schema.users)
          .innerJoin(schema.organizations, eq(schema.organizations.id, schema.users.organizationId))
          .where(orgCode ? and(eq(schema.users.email, email), eq(schema.organizations.code, orgCode)) : eq(schema.users.email, email));

        if (rows.length === 0) {
          await writeAuditLog({ action: "login.fail", entityType: "user", entityId: email, after: { reason: "usuario_inexistente" }, ip: forwarded });
          return null;
        }
        if (rows.length > 1) {
          // Correo compartido por varias organizaciones: exige el codigo.
          await writeAuditLog({ action: "login.fail", entityType: "user", entityId: email, after: { reason: "requiere_codigo_organizacion" }, ip: forwarded });
          return null;
        }
        const user = rows[0];
        if (!user.passwordHash || user.status !== "active") {
          await writeAuditLog({ actorId: user.id, action: "login.fail", entityType: "user", entityId: email, after: { reason: "usuario_inactivo" }, ip: forwarded });
          return null;
        }
        if (user.orgStatus !== "active") {
          await writeAuditLog({ actorId: user.id, action: "login.fail", entityType: "user", entityId: email, after: { reason: "organizacion_suspendida" }, ip: forwarded });
          return null;
        }
        const valid = await compare(password, user.passwordHash);
        if (!valid) {
          await writeAuditLog({ actorId: user.id, action: "login.fail", entityType: "user", entityId: email, after: { reason: "credenciales_invalidas" }, ip: forwarded });
          return null;
        }
        await writeAuditLog({ actorId: user.id, action: "login.success", entityType: "user", entityId: user.id, ip: forwarded });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Se resuelve por el id ya autenticado (no por correo, que puede repetirse
      // entre organizaciones) para no cruzar de inquilino al hidratar el token.
      if (user?.id) {
        const db = getDb();
        const [profile] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
        if (profile) {
          const rows = await db
            .select({ role: schema.roles.key, scopeId: schema.userRoles.scopeId })
            .from(schema.userRoles)
            .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
            .where(eq(schema.userRoles.userId, profile.id));
          token.uid = profile.id;
          token.roles = rows.map((row) => row.role);
          token.territoryId = rows[0]?.scopeId ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string | undefined;
        session.user.roles = token.roles as string[];
        session.user.territoryId = token.territoryId as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
