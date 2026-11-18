"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

// Ends the session (Better Auth deletes it from the Session table and
// clears the cookie), then goes to the home page.
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={signOut} disabled={pending}>
      Sign out
    </Button>
  );
}
