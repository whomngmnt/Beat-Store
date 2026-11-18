"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// Sends the browser to Google. After sign-in Google sends it back through
// /api/auth/callback/google to /account. If sign-in fails there, Better Auth
// sends it to /sign-in?error=…
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/sign-in",
    });
    // Only reached when the request to start sign-in failed. Otherwise the
    // browser is already on its way to Google.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={signIn} disabled={pending}>
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t start sign-in. Please try again.
        </p>
      ) : null}
    </div>
  );
}
