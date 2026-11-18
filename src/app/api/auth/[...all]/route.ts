// Better Auth's endpoints under /api/auth: starting Google sign-in, Google's
// callback (/api/auth/callback/google), reading the session, signing out.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
