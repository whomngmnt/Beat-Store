import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDownloadToken,
  hashToken,
  tokenMatches,
} from "../../src/lib/tokens";

const DAY = 24 * 60 * 60 * 1000;

describe("createDownloadToken", () => {
  it("makes a 43-character base64url token, its SHA-256 hash and a 30-day expiry", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const { token, hash, expiresAt } = createDownloadToken(now);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).not.toContain(token);
    expect(expiresAt.getTime() - now.getTime()).toBe(30 * DAY);
  });

  it("makes a different token every time", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => createDownloadToken().token),
    );
    expect(tokens.size).toBe(100);
  });
});

describe("tokenMatches", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const { token, hash, expiresAt } = createDownloadToken(now);

  it("accepts the token whose hash is stored, before it expires", () => {
    expect(tokenMatches(token, hash, expiresAt, now)).toBe(true);
    const lastMoment = new Date(expiresAt.getTime() - 1);
    expect(tokenMatches(token, hash, expiresAt, lastMoment)).toBe(true);
  });

  it("refuses another token", () => {
    const other = createDownloadToken(now).token;
    expect(tokenMatches(other, hash, expiresAt, now)).toBe(false);
  });

  it("refuses the right token once it has expired", () => {
    expect(tokenMatches(token, hash, expiresAt, expiresAt)).toBe(false);
    const later = new Date(expiresAt.getTime() + DAY);
    expect(tokenMatches(token, hash, expiresAt, later)).toBe(false);
  });

  it("refuses everything when the order has no token", () => {
    expect(tokenMatches(token, null, null, now)).toBe(false);
    expect(tokenMatches(token, hash, null, now)).toBe(false);
  });

  it("refuses the hash itself used as the token", () => {
    expect(tokenMatches(hash, hash, expiresAt, now)).toBe(false);
  });

  it("refuses instead of throwing when the stored hash is damaged", () => {
    expect(tokenMatches(token, "abc", expiresAt, now)).toBe(false);
    expect(hashToken(token)).toHaveLength(64);
  });
});
