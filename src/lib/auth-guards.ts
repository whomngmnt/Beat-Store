// Who is signed in (PLAN.md §5.3). Every protected page, route handler and
// server action calls requireUser() or requireAdmin() before doing anything.
//
// There's no proxy.ts. A proxy can only see that a session cookie exists,
// not that it's valid (CVE-2025-29927 also showed it can be skipped), so it
// would never be the real check. These functions are.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The signed-in user, or null. Better Auth looks the session cookie up in
// the Session table on every call, so a deleted or expired session counts
// as signed out straight away.
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

// Signed out: go to the sign-in page. redirect() throws, so the code after
// the call never runs for a signed-out visitor.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

// Signed out: the sign-in page. Signed in but not an admin: the home page.
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
