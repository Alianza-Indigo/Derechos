import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { users } from "@/lib/mock-data";

// Los usuarios semilla comparten una contrasena de demostracion, pero la
// verificacion se hace con bcrypt real. En produccion cada usuario trae su
// propio `passwordHash` desde la base de datos (ver `drizzle/seed.ts`).
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-seguro";
let demoHashPromise: Promise<string> | null = null;

function demoPasswordHash() {
  demoHashPromise ??= hash(DEMO_PASSWORD, 10);
  return demoHashPromise;
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

        const user = users.find((item) => item.email.toLowerCase() === email);
        if (!user || user.status !== "active") {
          return null;
        }

        const expectedHash = user.passwordHash ?? (await demoPasswordHash());
        const valid = await compare(password, expectedHash);
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
      const email = user?.email ?? token.email;
      if (email) {
        const profile = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
        token.uid = profile?.id;
        token.roles = profile?.roles ?? [];
        token.territoryId = profile?.territoryId;
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
