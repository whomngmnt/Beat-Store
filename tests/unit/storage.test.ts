import { afterEach, describe, expect, it, vi } from "vitest";

// The S3 client is kept once made, so each test loads a fresh module.
async function freshStorage() {
  vi.resetModules();
  return import("../../src/lib/storage");
}

function stubS3Env() {
  vi.stubEnv("S3_ENDPOINT", "https://account123.r2.cloudflarestorage.com");
  vi.stubEnv("S3_ACCESS_KEY_ID", "fake-access-key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "fake-secret");
  vi.stubEnv("S3_PRIVATE_BUCKET", "beatstore-files");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signDownloadUrl", () => {
  it("signs a 10-minute GET link to the private bucket, offline", async () => {
    stubS3Env();
    const { signDownloadUrl } = await freshStorage();

    const url = new URL(
      await signDownloadUrl("uploads/beat-1/abc.wav", "paper-lanterns.wav"),
    );

    // The SDK puts the bucket in the host name (virtual-hosted style).
    expect(url.origin).toBe(
      "https://beatstore-files.account123.r2.cloudflarestorage.com",
    );
    expect(url.pathname).toBe("/uploads/beat-1/abc.wav");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    // Only the host is signed, so a plain browser GET matches the signature.
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="paper-lanterns.wav"',
    );
    // The secret itself never appears in the link.
    expect(url.href).not.toContain("fake-secret");
  });

  it("refuses to sign without the storage settings", async () => {
    vi.stubEnv("S3_PRIVATE_BUCKET", "beatstore-files");
    vi.stubEnv("S3_ENDPOINT", "");
    const { signDownloadUrl } = await freshStorage();
    expect(() => signDownloadUrl("a.wav", "a.wav")).toThrow(/S3_ENDPOINT/);
  });

  it("refuses to sign without a private bucket", async () => {
    stubS3Env();
    vi.stubEnv("S3_PRIVATE_BUCKET", "");
    const { signDownloadUrl } = await freshStorage();
    expect(() => signDownloadUrl("a.wav", "a.wav")).toThrow(
      /S3_PRIVATE_BUCKET/,
    );
  });
});
