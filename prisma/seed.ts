// Seed data (PLAN.md §8, Phase 1): 4 license tiers, the first admin, 12 demo beats.
// Run with `pnpm db:seed`. tsx runs this file and resolves the `@/` paths
// from tsconfig.json.
//
// Safe to run again: every upsert has `update: {}`, so a second run only adds
// what's missing and never overwrites edits. The one exception is the admin,
// whose role is always set back to ADMIN. To start over:
// `pnpm prisma migrate reset`, then `pnpm db:seed`.
//
// Demo beats have no audio or cover yet (file keys stay empty). Preview audio
// comes in Phase 3.

// First, so DATABASE_URL is set before db.ts creates the client.
import "dotenv/config";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// Defaults from PLAN.md §3. Prices are integer cents.
const tiers: Prisma.LicenseTierCreateInput[] = [
  {
    code: "BASIC",
    name: "Basic Lease",
    description: "Untagged MP3 for small releases and non-profit videos.",
    defaultPriceCents: 2999,
    includesMp3: true,
    includesWav: false,
    includesStems: false,
    streamLimit: 5000,
    videoLimit: 1,
    terms:
      "Non-exclusive lease. You get an untagged MP3. Up to 5,000 streams and 1 non-profit video. Credit the producer in the title or description.",
    sortOrder: 1,
  },
  {
    code: "PREMIUM",
    name: "Premium Lease",
    description: "MP3 and WAV for releases with up to 50,000 streams.",
    defaultPriceCents: 4999,
    includesMp3: true,
    includesWav: true,
    includesStems: false,
    streamLimit: 50000,
    videoLimit: 1,
    terms:
      "Non-exclusive lease. You get an untagged MP3 and a WAV. Up to 50,000 streams and 1 music video. Credit the producer in the title or description.",
    sortOrder: 2,
  },
  {
    code: "TRACKOUT",
    name: "Trackout / Stems",
    description: "MP3, WAV and stems for mixing, plus live shows.",
    defaultPriceCents: 9999,
    includesMp3: true,
    includesWav: true,
    includesStems: true,
    streamLimit: 500000,
    videoLimit: 2,
    terms:
      "Non-exclusive lease. You get an untagged MP3, a WAV and the stems as a ZIP. Up to 500,000 streams, 2 music videos and live performances. Credit the producer in the title or description.",
    sortOrder: 3,
  },
  {
    code: "EXCLUSIVE",
    name: "Exclusive",
    description:
      "All files and full ownership. The beat leaves the store after the sale.",
    defaultPriceCents: 49900,
    includesMp3: true,
    includesWav: true,
    includesStems: true,
    streamLimit: null,
    videoLimit: null,
    terms:
      "Exclusive rights. You get every file, and ownership of the beat transfers to you. No limit on streams, videos or performances. The beat is removed from the store after the sale.",
    sortOrder: 4,
  },
];

const beats: Prisma.BeatCreateInput[] = [
  {
    slug: "midnight-drive",
    title: "Midnight Drive",
    description: "Dark trap with heavy 808s and a slow, eerie melody.",
    bpm: 140,
    musicalKey: "F# minor",
    genre: "Trap",
    mood: "Dark",
    tags: ["trap", "dark", "808"],
    plays: 1240,
    featured: true,
  },
  {
    slug: "static-ghost",
    title: "Static Ghost",
    description: "Bell melody over fast hi-hats and a hard-hitting 808.",
    bpm: 150,
    musicalKey: "B minor",
    genre: "Trap",
    mood: "Eerie",
    tags: ["trap", "bells", "hard"],
    plays: 860,
  },
  {
    slug: "cold-concrete",
    title: "Cold Concrete",
    description: "UK drill groove with sliding 808s and sparse piano.",
    bpm: 142,
    musicalKey: "C minor",
    genre: "Drill",
    mood: "Aggressive",
    tags: ["drill", "sliding 808", "piano"],
    plays: 1530,
    featured: true,
  },
  {
    slug: "iron-will",
    title: "Iron Will",
    description: "Choir chops over a bouncy drill pattern.",
    bpm: 144,
    musicalKey: "G minor",
    genre: "Drill",
    mood: "Aggressive",
    tags: ["drill", "choir"],
    plays: 610,
  },
  {
    slug: "paper-lanterns",
    title: "Paper Lanterns",
    description: "Warm jazzy keys and soft vinyl crackle.",
    bpm: 82,
    musicalKey: "D major",
    genre: "Lo-fi",
    mood: "Chill",
    tags: ["lo-fi", "jazzy", "study"],
    plays: 2010,
    featured: true,
  },
  {
    slug: "rooftop-rain",
    title: "Rooftop Rain",
    description: "Rainy lo-fi with mellow Rhodes chords.",
    bpm: 75,
    musicalKey: "F major",
    genre: "Lo-fi",
    mood: "Relaxed",
    tags: ["lo-fi", "rain", "keys"],
    plays: 940,
  },
  {
    slug: "velvet-hours",
    title: "Velvet Hours",
    description: "Smooth R&B with clean guitar and soft pads.",
    bpm: 94,
    musicalKey: "Ab major",
    genre: "R&B",
    mood: "Romantic",
    tags: ["rnb", "guitar", "smooth"],
    plays: 720,
  },
  {
    slug: "late-checkout",
    title: "Late Checkout",
    description: "Moody late-night R&B with deep bass.",
    bpm: 88,
    musicalKey: "Bb minor",
    genre: "R&B",
    mood: "Moody",
    tags: ["rnb", "late night"],
    plays: 480,
  },
  {
    slug: "dusty-crates",
    title: "Dusty Crates",
    description: "Classic boom bap drums under a chopped soul sample.",
    bpm: 90,
    musicalKey: "E minor",
    genre: "Boom Bap",
    mood: "Nostalgic",
    tags: ["boom bap", "soul", "vinyl"],
    plays: 1100,
  },
  {
    slug: "golden-coast",
    title: "Golden Coast",
    description: "Bright Afrobeat with layered percussion and a summer feel.",
    bpm: 104,
    musicalKey: "G major",
    genre: "Afrobeat",
    mood: "Uplifting",
    tags: ["afrobeat", "summer", "percussion"],
    plays: 1350,
  },
  {
    slug: "glass-heart",
    title: "Glass Heart",
    description: "Catchy pop beat with piano and a big chorus drop.",
    bpm: 118,
    musicalKey: "C major",
    genre: "Pop",
    mood: "Happy",
    tags: ["pop", "piano"],
    plays: 530,
  },
  {
    slug: "first-light",
    title: "First Light",
    description: "Anthemic pop with acoustic guitar and claps.",
    bpm: 110,
    musicalKey: "D major",
    genre: "Pop",
    mood: "Uplifting",
    tags: ["pop", "guitar", "anthem"],
    plays: 390,
  },
];

async function main() {
  // The real address lives only in .env, never in this file.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL is not set in .env");

  for (const tier of tiers) {
    await db.licenseTier.upsert({
      where: { code: tier.code },
      update: {},
      create: tier,
    });
  }

  await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Admin", role: "ADMIN" },
  });

  // Each beat gets one BeatLicense per tier, priced at the tier's default.
  const allTiers = await db.licenseTier.findMany();
  for (const beat of beats) {
    await db.beat.upsert({
      where: { slug: beat.slug },
      update: {},
      create: {
        ...beat,
        status: "PUBLISHED",
        licenses: {
          create: allTiers.map((tier) => ({
            licenseTierId: tier.id,
            priceCents: tier.defaultPriceCents,
          })),
        },
      },
    });
  }

  const [tierCount, beatCount, licenseCount] = await Promise.all([
    db.licenseTier.count(),
    db.beat.count(),
    db.beatLicense.count(),
  ]);
  console.log(
    `Seed done: ${tierCount} license tiers, ${beatCount} beats, ${licenseCount} beat licenses, admin ready.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
