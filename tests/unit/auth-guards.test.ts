// requireUser() and requireAdmin() (PLAN.md §5.3). Better Auth's session
// lookup and Next's redirect() are faked: redirect() throws, as the real one
// does, so code after a failed check never runs.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentUser,
  requireAdmin,
  requireUser,
} from "../../src/lib/auth-guards";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("../../src/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect to ${url}`);
  },
}));

function signedInAs(role: "USER" | "ADMIN") {
  const user = { id: "user-1", email: "a@example.com", role };
  getSession.mockResolvedValue({ user, session: { id: "session-1" } });
  return user;
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue(null);
});

describe("getCurrentUser", () => {
  it("returns null when nobody is signed in", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the session's user", async () => {
    const user = signedInAs("USER");
    expect(await getCurrentUser()).toEqual(user);
  });
});

describe("requireUser", () => {
  it("sends a signed-out visitor to /sign-in", async () => {
    await expect(requireUser()).rejects.toThrow("redirect to /sign-in");
  });

  it("returns the signed-in user", async () => {
    const user = signedInAs("USER");
    expect(await requireUser()).toEqual(user);
  });
});

describe("requireAdmin", () => {
  it("sends a signed-out visitor to /sign-in", async () => {
    await expect(requireAdmin()).rejects.toThrow("redirect to /sign-in");
  });

  it("sends a signed-in non-admin to the home page", async () => {
    signedInAs("USER");
    await expect(requireAdmin()).rejects.toThrow("redirect to /");
  });

  it("returns an admin", async () => {
    const admin = signedInAs("ADMIN");
    expect(await requireAdmin()).toEqual(admin);
  });
});
