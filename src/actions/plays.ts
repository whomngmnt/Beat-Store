"use server";

import { db } from "@/lib/db";
import { beatIdSchema } from "@/lib/validators";

// Adds one play to a beat. PlayerBar calls it once per track, after 10 s of
// real listening (see timeUpdate in src/store/player.ts).
//
// Public on purpose: visitors listen without signing in, so there's no
// requireUser() here. The id is typed `unknown` because anyone can call a
// server action with any value; Zod checks it. Only beats on show (the
// same statuses the catalog lists) can be counted.
// Known limit: someone could call this over and over to push a beat up the
// "Popular" sort. The rate-limiting later slice (Upstash) covers that.
export async function recordPlay(beatId: unknown) {
  const id = beatIdSchema.safeParse(beatId);
  if (!id.success) return;

  // One UPDATE that adds 1 in the database (plays = plays + 1), so two plays
  // at the same moment can't overwrite each other. updateMany doesn't throw
  // when no beat matches.
  await db.beat.updateMany({
    where: { id: id.data, status: { in: ["PUBLISHED", "RESERVED"] } },
    data: { plays: { increment: 1 } },
  });
}
