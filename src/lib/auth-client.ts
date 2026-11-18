// Better Auth in the browser: the sign-in and sign-out buttons call this.
// It talks to /api/auth on the same site, so it needs no settings.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
