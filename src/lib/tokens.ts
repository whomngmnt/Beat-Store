// Guest download tokens (PLAN.md §5.1). A guest has no account, so the
// download link carries a random token instead. Only its SHA-256 hash is
// stored (Order.downloadTokenHash): someone who reads the database still
// can't build a working link.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_DAYS = 30;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// A new token: 32 random bytes as base64url (43 characters, safe in a URL),
// its hash for the database, and when it stops working.
export function createDownloadToken(now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(now.getTime() + TOKEN_DAYS * 24 * 60 * 60 * 1000),
  };
}

// True if `token` is the one whose hash is stored and it hasn't expired.
// timingSafeEqual takes as long whether the first or the last character
// differs, so response times give away nothing about the stored hash.
export function tokenMatches(
  token: string,
  storedHash: string | null,
  expiresAt: Date | null,
  now = new Date(),
): boolean {
  if (!storedHash || !expiresAt || expiresAt <= now) return false;
  const given = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  // Both are SHA-256 hashes (32 bytes); timingSafeEqual throws on a length
  // mismatch, which only a damaged stored value could cause.
  return given.length === stored.length && timingSafeEqual(given, stored);
}
