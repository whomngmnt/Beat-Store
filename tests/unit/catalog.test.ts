import { describe, expect, it } from "vitest";
import type {
  BeatStatus,
  LicenseCode,
} from "../../src/generated/prisma/client";
import { cartLineProblem } from "../../src/lib/catalog";

// One license of a beat, as the cart and checkout read it.
function line(status: BeatStatus, code: LicenseCode, active = true) {
  return { active, beat: { status }, licenseTier: { code } };
}

const LEASES: LicenseCode[] = ["BASIC", "PREMIUM", "TRACKOUT"];
const ALL_TIERS: LicenseCode[] = [...LEASES, "EXCLUSIVE"];

// The license tier rules: which license can be bought for each beat status.
describe("cartLineProblem", () => {
  it.each(ALL_TIERS)("sells every tier of a published beat: %s", (code) => {
    expect(cartLineProblem(line("PUBLISHED", code))).toBeNull();
  });

  it.each(LEASES)(
    "still sells leases while a checkout holds the exclusive: %s",
    (code) => {
      expect(cartLineProblem(line("RESERVED", code))).toBeNull();
    },
  );

  it("blocks the exclusive while a checkout holds it", () => {
    expect(cartLineProblem(line("RESERVED", "EXCLUSIVE"))).toBe(
      "Reserved, check back soon",
    );
  });

  it.each(ALL_TIERS)("sells nothing of a sold beat: %s", (code) => {
    expect(cartLineProblem(line("SOLD", code))).toBe("Sold");
  });

  it.each(ALL_TIERS)("sells nothing of a draft: %s", (code) => {
    expect(cartLineProblem(line("DRAFT", code))).toBe("No longer available");
  });

  it.each(["PUBLISHED", "RESERVED"] as const)(
    "doesn't sell a license the admin turned off (%s beat)",
    (status) => {
      expect(cartLineProblem(line(status, "BASIC", false))).toBe(
        "No longer available",
      );
    },
  );
});
