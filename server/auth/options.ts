import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { users } from "@/lib/mock-data";

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
        const email = credentials?.email?.toLowerCase();
        const password = credentials?.password;
        const user = users.find((item) => item.email.toLowerCase() === email);
        if (!user || password !== "demo-seguro") {
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
        const profile = users.find((item) => item.email === user.email);
        token.roles = profile?.roles ?? [];
        token.territoryId = profile?.territoryId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
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
