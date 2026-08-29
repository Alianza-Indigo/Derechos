import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
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
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) {
          return null;
        }
        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
        const limit = await rateLimit(`login:${forwarded || "local"}`, 8, 60);
        if (!limit.allowed) {
          return null;
        }
        const db = getDb();
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
        if (!user?.passwordHash || user.status !== "active") {
          await writeAuditLog({ actorId: user?.id, action: "login.fail", entityType: "user", entityId: email, after: { reason: "usuario_inexistente_o_inactivo" }, ip: forwarded });
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
      if (user?.email) {
        const db = getDb();
        const [profile] = await db.select().from(schema.users).where(eq(schema.users.email, user.email)).limit(1);
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
