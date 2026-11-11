// Runs before every integration test file, before it imports app code.
// DATABASE_URL comes from .env (the local Docker Postgres).
import "dotenv/config";

// Fake Stripe settings, so a real key in .env is never used by a test.
// Signing and checking webhook signatures works offline with any secret.
process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_for_tests";
process.env.CRON_SECRET = "cron_secret_for_tests";
