import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getCurrentUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

// Google is the only way in for v1. After sign-in the browser always goes to
// /account: there's no "?next=" setting, so this page can't be used to send
// people to another site.
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  if (await getCurrentUser()) redirect("/account");

  // Better Auth adds ?error=<code> when sign-in fails. The code itself is
  // never shown: one plain message covers every case.
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="text-muted-foreground">
        Sign in to see your orders and download your files again. You don&apos;t
        need an account to buy.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Sign-in didn&apos;t work. Please try again, or contact support if it
          keeps happening.
        </p>
      ) : null}
      <GoogleSignInButton />
    </div>
  );
}
