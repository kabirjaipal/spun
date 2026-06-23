import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { mUsers, pAccounts, pSessions, pVerificationTokens } from "@/lib/db/schema";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getUserPagePermissions } from "@/lib/permissions";

declare module "next-auth" {
  interface User {
    companyId?: string | null;
    role?: string;
    allowedPages?: string[];
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      companyId?: string | null;
      role?: string;
      allowedPages?: string[];
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: mUsers,
    accountsTable: pAccounts,
    sessionsTable: pSessions,
    verificationTokensTable: pVerificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        // Drizzle query using the schema mapping
        const user = await db.query.mUsers.findFirst({
          where: (users, { eq }) => eq(users.email, credentials.email as string),
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        // Verify password using bcryptjs
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // Fetch page permissions (read = true)
        const permissions = await getUserPagePermissions(user.id);
        const allowedPages = permissions.map((p) => p.pageUrl).filter((url): url is string => !!url);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId ? user.companyId.toString() : null,
          role: user.role, // Use user's role from m_users table directly
          allowedPages,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (user?.id) {
        const dbUser = await db.query.mUsers.findFirst({
          where: eq(mUsers.id, user.id),
        });
        if (dbUser && !dbUser.isActive) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // companyId may be a BigInt (from DrizzleAdapter on OAuth) — always serialize to string
        token.companyId = user.companyId != null ? String(user.companyId) : null;
        token.role = user.role || "company";
        token.allowedPages = user.allowedPages || [];
      } else if (token.id) {
        // Query database to get the latest companyId and role so that the token stays updated
        const dbUser = await db.query.mUsers.findFirst({
          where: eq(mUsers.id, token.id as string),
        });
        if (!dbUser || !dbUser.isActive) {
          return null as any;
        }
        token.companyId = dbUser.companyId ? dbUser.companyId.toString() : null;
        token.role = dbUser.role;
        
        // Fetch allowed pages
        const permissions = await getUserPagePermissions(dbUser.id);
        token.allowedPages = permissions.map((p) => p.pageUrl).filter((url): url is string => !!url);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.companyId = token.companyId as string | null;
        session.user.role = (token.role as string) || "company";
        session.user.allowedPages = token.allowedPages as string[] || [];
      } else {
        return null as any;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

