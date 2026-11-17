// Sign-in (PLAN.md §5.3): Better Auth with Google, with users, sessions and
// linked Google accounts stored in Postgres through Prisma. v1 has no
// passwords; magic-link sign-in comes with the email slice.
//
// Better Auth reads two env vars itself: BETTER_AUTH_SECRET (signs the
// session cookie) and BETTER_AUTH_URL (the site's address, used for
// Google's callback URL).
//
// This file only sets Better Auth up. Pages, routes and actions find out who
// is signed in through src/lib/auth-guards.ts.
//
// Account linking keeps Better Auth's defaults: a Google sign-in joins an
// existing user with the same email only if Google has verified the email
// AND the existing user is verified too. That's why the seed marks the admin
// as verified.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Always show Google's account picker, so signing in again after
      // signing out doesn't silently reuse the last account.
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      // Our own column (USER or ADMIN). input: false means sign-in can never
      // set it, so nobody can make themselves an admin. New users get USER.
      role: { type: "string", input: false, defaultValue: "USER" },
    },
  },
  advanced: {
    // Ids come from the schema (@default(uuid())), as for every other table.
    database: { generateId: false },
  },
});
