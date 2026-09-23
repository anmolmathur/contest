import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import { users, contestUsers, contests } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { userTypeForEmail } from "@/lib/user-type";

/** Case-insensitive user lookup (older rows have mixed-case emails). */
async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
  });
}

/** Google SSO is on when both env vars are set (AUTH_GOOGLE_ID/SECRET or GOOGLE_CLIENT_ID/SECRET). */
export function googleSsoEnabled(): boolean {
  return !!(
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)
  );
}

/**
 * First Google login auto-creates the account. Existing accounts with the
 * same (verified) email are reused, so a user who registered with a password
 * can also sign in with Google. userType is refreshed from the email domain
 * on every login.
 */
async function upsertGoogleUser(profile: { email: string; name?: string | null; picture?: string | null }) {
  const email = profile.email.trim().toLowerCase();
  const userType = userTypeForEmail(email);
  const existing = await findUserByEmail(email);
  if (existing) {
    await db
      .update(users)
      .set({
        name: existing.name || profile.name || email.split("@")[0],
        image: existing.image || profile.picture || null,
        emailVerified: existing.emailVerified ?? new Date(),
        userType,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return { ...existing, userType };
  }
  const [created] = await db
    .insert(users)
    .values({
      email,
      name: profile.name || email.split("@")[0],
      image: profile.picture || null,
      emailVerified: new Date(),
      userType,
      department: userType === "internal" ? "TeamLease" : null,
    })
    .returning();
  return created;
}

const providers: Provider[] = [];

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
      userType: "internal" | "external";
    } & DefaultSession["user"];
  }

  interface User {
    role?: string | null;
    teamId?: string | null;
    globalRole?: string;
    legacyRole?: LegacyRole;
    userType?: "internal" | "external";
  }
}

providers.push(
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await findUserByEmail(credentials.email as string);

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
          userType: (user.userType as "internal" | "external") ?? "external",
        };
      },
    }),
);

if (googleSsoEnabled()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      // Always show the account chooser so students can pick Gmail vs. work account.
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const email = profile?.email;
      // Only accept Google-verified addresses (prevents account takeover via unverified emails).
      if (!email || profile?.email_verified === false) return "/login?error=GoogleEmailUnverified";
      await upsertGoogleUser({
        email,
        name: profile?.name ?? null,
        picture: (profile as { picture?: string } | undefined)?.picture ?? null,
      });
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        // Map the Google identity onto our own users row.
        const dbUser = await findUserByEmail(profile.email);
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.teamId = dbUser.teamId;
          token.globalRole = dbUser.globalRole;
          token.legacyRole = await computeLegacyRole(dbUser.id);
          token.userType = dbUser.userType;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
        return token;
      }
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.globalRole = user.globalRole;
        token.legacyRole = user.legacyRole ?? null;
        token.userType = user.userType ?? "external";
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
        session.user.userType = (token.userType as "internal" | "external") ?? "external";
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
