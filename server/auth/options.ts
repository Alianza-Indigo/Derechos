import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import * as schema from "@/drizzle/schema";
import type { RoleKey } from "@/lib/types";
import { getDb } from "@/server/db";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled" | "pending";
  passwordHash: string | null;
  territoryId: string | null;
  roles: RoleKey[];
};

async function loadAuthUser(email: string): Promise<AuthUser | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      passwordHash: schema.users.passwordHash,
      territoryId: schema.users.territoryId,
      roleKey: schema.roles.key,
    })
    .from(schema.users)
    .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .leftJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.users.email, email));

  if (!rows.length) {
    return null;
  }

  const roles = rows.map((row) => row.roleKey).filter((key): key is string => Boolean(key)) as RoleKey[];
  const base = rows[0];
  return {
    id: base.id,
    name: base.name,
    email: base.email,
    status: base.status,
    passwordHash: base.passwordHash,
    territoryId: base.territoryId,
    roles,
  };
}

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

        const user = await loadAuthUser(email);
        if (!user || user.status !== "active" || !user.passwordHash) {
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
        const profile = await loadAuthUser(user.email.toLowerCase());
        token.uid = profile?.id;
        token.roles = profile?.roles ?? [];
        token.territoryId = profile?.territoryId ?? undefined;
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
