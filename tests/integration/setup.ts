// Runs before every integration test file, before it imports app code.
// DATABASE_URL comes from .env (the local Docker Postgres).
import "dotenv/config";
import { vi } from "vitest";

// Nobody is signed in. Outside a real request Next's headers() can't be
// read, so the session lookup is faked for every test file. A test signs
// someone in with vi.mocked(getCurrentUser).mockResolvedValue(user).
//
// requireUser() and requireAdmin() follow the real rules (unit-tested in
// tests/unit/auth-guards.test.ts) on top of the faked getCurrentUser. A
// redirect becomes a thrown error, as the real redirect() throws too.
vi.mock("../../src/lib/auth-guards", () => {
  const getCurrentUser = vi.fn<() => Promise<{ role: string } | null>>(
    async () => null,
  );
  async function requireUser() {
    const user = await getCurrentUser();
    if (!user) throw new Error("redirect to /sign-in");
    return user;
  }
  async function requireAdmin() {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new Error("redirect to /");
    return user;
  }
  return { getCurrentUser, requireUser, requireAdmin };
});

// Fake Stripe settings, so a real key in .env is never used by a test.
// Signing and checking webhook signatures works offline with any secret.
process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_for_tests";
process.env.CRON_SECRET = "cron_secret_for_tests";

// Fake storage settings. Signing a download link works offline, so no test
// reaches R2.
process.env.S3_ENDPOINT = "https://fake-account.r2.cloudflarestorage.com";
process.env.S3_ACCESS_KEY_ID = "fake_access_key_for_tests";
process.env.S3_SECRET_ACCESS_KEY = "fake_secret_for_tests";
process.env.S3_PRIVATE_BUCKET = "beatstore-files";
process.env.S3_PUBLIC_BUCKET = "beatstore-previews";
