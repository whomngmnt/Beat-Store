// Exclusive reservations (PLAN.md §5.4, .claude/rules/exclusives.md).
//
// Each function is one conditional UPDATE, so Postgres row locking decides
// who wins. Never read the beat first and update it after: two checkouts
// could both read "PUBLISHED" and both reserve it.
//
// Times use the database clock (`now()`), never the server's, so every
// check compares against the same clock.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// How long a checkout holds an exclusive. It's longer than the Stripe
// session (31 minutes, see src/actions/checkout.ts), so the hold can't run
// out while the buyer can still pay.
//
// Returns true if this order now holds the beat. It can take over a hold
// that has run out (the cron job may not have freed it yet). Call it inside
// the transaction that creates the order, so a failure rolls the order back.
export async function reserveExclusive(
  tx: Prisma.TransactionClient,
  beatId: string,
  orderId: string,
): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE "Beat"
    SET status = 'RESERVED',
        "reservedByOrderId" = ${orderId},
        "reservedUntil" = now() + interval '35 minutes'
    WHERE id = ${beatId}
      AND (status = 'PUBLISHED'
           OR (status = 'RESERVED' AND "reservedUntil" < now()))`;
  return changed === 1;
}

// Frees the beats this order holds, when its checkout fails or expires.
// Only RESERVED beats: a beat this order bought (SOLD) stays sold.
export async function releaseReservations(
  client: Prisma.TransactionClient,
  orderId: string,
): Promise<number> {
  const released = await client.beat.updateMany({
    where: { reservedByOrderId: orderId, status: "RESERVED" },
    data: { status: "PUBLISHED", reservedByOrderId: null, reservedUntil: null },
  });
  return released.count;
}

// The cron job's safety net, in case a checkout.session.expired event is
// lost: frees every hold that has run out. Returns how many beats it freed.
export async function releaseExpiredReservations(): Promise<number> {
  return db.$executeRaw`
    UPDATE "Beat"
    SET status = 'PUBLISHED', "reservedByOrderId" = NULL, "reservedUntil" = NULL
    WHERE status = 'RESERVED' AND "reservedUntil" < now()`;
}
