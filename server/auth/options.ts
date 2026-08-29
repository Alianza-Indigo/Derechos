import type { NextAuthOptions } from "next-auth";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import CredentialsProvider from "next-auth/providers/credentials";
import * as schema from "@/drizzle/schema";
import { getDb } from "@/server/db";

export const authOptions: NextAuthOptions = {
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
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) {
          return null;
        }
        const db = getDb();
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
        if (!user?.passwordHash || user.status !== "active") {
          return null;
        }
        const valid = await compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }
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
