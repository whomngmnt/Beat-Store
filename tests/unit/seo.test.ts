import { afterEach, describe, expect, it, vi } from "vitest";
import type { BeatDetail, BeatDetailLicense } from "../../src/lib/catalog";
import type { LicenseCode } from "../../src/generated/prisma/client";

afterEach(() => {
  vi.unstubAllEnvs();
});

// siteUrl is read when seo.ts loads, so each test sets the env first and
// then loads a fresh copy of the module.
async function jsonLdText(beat: BeatDetail, cdnUrl = "") {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://beats.example");
  vi.stubEnv("PUBLIC_CDN_URL", cdnUrl);
  vi.resetModules();
  const { beatJsonLd } = await import("../../src/lib/seo");
  return beatJsonLd(beat);
}

function license(
  code: LicenseCode,
  name: string,
  priceCents: number,
): BeatDetailLicense {
  return {
    priceCents,
    licenseTier: {
      id: `tier-${code}`,
      code,
      name,
      description: "",
      includesMp3: true,
      includesWav: false,
      includesStems: false,
      streamLimit: null,
      videoLimit: null,
      terms: "",
    },
  };
}

function beat(overrides: Partial<BeatDetail> = {}): BeatDetail {
  return {
    id: "beat-1",
    slug: "midnight-drive",
    title: "Midnight Drive",
    previewKey: "previews/midnight-drive.mp3",
    coverKey: "covers/midnight-drive.jpg",
    description: "Dark trap with heavy 808s.",
    bpm: 140,
    musicalKey: "A minor",
    genre: "Trap",
    mood: "Dark",
    tags: ["dark", "808"],
    status: "PUBLISHED",
    licenses: [
      license("BASIC", "Basic", 2999),
      license("PREMIUM", "Premium", 3000),
      license("EXCLUSIVE", "Exclusive", 49900),
    ],
    ...overrides,
  };
}

describe("beatJsonLd", () => {
  it("describes the beat as a Product and a MusicRecording, with full URLs", async () => {
    const data = JSON.parse(await jsonLdText(beat()));

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": ["Product", "MusicRecording"],
      name: "Midnight Drive",
      description: "Dark trap with heavy 808s.",
      url: "https://beats.example/beats/midnight-drive",
      // No PUBLIC_CDN_URL: the cover is served by the site itself.
      image: "https://beats.example/covers/midnight-drive.jpg",
      genre: "Trap",
      keywords: "dark, 808",
    });
  });

  it("keeps a cover URL on the CDN as it is", async () => {
    const data = JSON.parse(
      await jsonLdText(beat(), "https://cdn.example/beatstore-previews"),
    );
    expect(data.image).toBe(
      "https://cdn.example/beatstore-previews/covers/midnight-drive.jpg",
    );
  });

  it("has one offer per license, priced in dollars from whole cents", async () => {
    const data = JSON.parse(await jsonLdText(beat()));

    expect(data.offers).toEqual(
      [
        ["Basic", "29.99"],
        ["Premium", "30.00"],
        ["Exclusive", "499.00"],
      ].map(([name, price]) => ({
        "@type": "Offer",
        name,
        price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      })),
    );
  });

  it("marks only the exclusive out of stock while the beat is reserved", async () => {
    const data = JSON.parse(await jsonLdText(beat({ status: "RESERVED" })));

    expect(
      data.offers.map((offer: { availability: string }) => offer.availability),
    ).toEqual([
      "https://schema.org/InStock",
      "https://schema.org/InStock",
      "https://schema.org/OutOfStock",
    ]);
  });

  it("gives a sold beat no offers, as its page shows no prices", async () => {
    const data = JSON.parse(await jsonLdText(beat({ status: "SOLD" })));
    expect(data).not.toHaveProperty("offers");
  });

  it("leaves out an empty description, a missing cover and empty tags", async () => {
    const data = JSON.parse(
      await jsonLdText(beat({ description: "", coverKey: null, tags: [] })),
    );
    expect(data).not.toHaveProperty("description");
    expect(data).not.toHaveProperty("image");
    expect(data).not.toHaveProperty("keywords");
  });

  it("can't end the script tag, whatever the description says", async () => {
    const description = "Hard </script><script>alert(1)</script> beat";
    const text = await jsonLdText(beat({ description }));

    // No "<" at all, so no closing tag. The JSON still reads it back.
    expect(text).not.toContain("<");
    expect(JSON.parse(text).description).toBe(description);
  });
});
