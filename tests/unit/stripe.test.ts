import { afterEach, describe, expect, it, vi } from "vitest";

// getStripe() keeps its client once made, so each test loads a fresh copy
// of the module.
async function freshGetStripe() {
  vi.resetModules();
  return (await import("../../src/lib/stripe")).getStripe;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStripe", () => {
  it.each([
    ["a live key", "sk_live_123"],
    ["a publishable key", "pk_test_123"],
    ["an empty key", ""],
  ])("refuses %s", async (_label, key) => {
    vi.stubEnv("STRIPE_SECRET_KEY", key);
    const getStripe = await freshGetStripe();
    expect(() => getStripe()).toThrow(/test key/);
  });

  it("makes one client from a test key and reuses it", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const getStripe = await freshGetStripe();
    expect(getStripe()).toBe(getStripe());
  });
});
