// Runs before every integration test file, before it imports app code.
// DATABASE_URL comes from .env (the local Docker Postgres).
import "dotenv/config";

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
