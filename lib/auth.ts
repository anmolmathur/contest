import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users, contestUsers, contests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * `legacyRole` is a derived field surfaced on the session for backward
 * compatibility with the pre-multi-tenant UI (/dashboard, /admin, /judging).
 * It reflects the caller's role in the *default contest* and is computed
 * once at login (JWT is stale-on-re-login).
 */
export type LegacyRole = "admin" | "judge" | "participant" | null;

async function computeLegacyRole(userId: string): Promise<LegacyRole> {
  // Pick the default contest (same resolution logic as lib/contest-auth.ts)
  const byFlag = await db.query.contests.findFirst({
    where: eq(contests.isDefault, true),
  });
  const byStatus = byFlag
    ? null
    : await db.query.contests.findFirst({
        where: eq(contests.status, "active"),
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      });
  const fallback = byFlag || byStatus
    ? null
    : await db.query.contests.findFirst({
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      });
  const contest = byFlag ?? byStatus ?? fallback;
  if (!contest) return null;

  const cu = await db.query.contestUsers.findFirst({
    where: and(
      eq(contestUsers.contestId, contest.id),
      eq(contestUsers.userId, userId),
    ),
  });
  return (cu?.role as LegacyRole) ?? null;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string | null;
      teamId: string | null;
      globalRole: string;
      legacyRole: LegacyRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: string | null;
    teamId: string | null;
    globalRole: string;
    legacyRole?: LegacyRole;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        const legacyRole = await computeLegacyRole(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          teamId: user.teamId,
          globalRole: user.globalRole,
          legacyRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.globalRole = user.globalRole;
        token.legacyRole = user.legacyRole ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string | null;
        session.user.teamId = token.teamId as string | null;
        session.user.globalRole = (token.globalRole as string) || "user";
        session.user.legacyRole = (token.legacyRole as LegacyRole) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
