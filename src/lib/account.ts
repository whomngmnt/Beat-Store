// Which orders belong to a signed-in user (PLAN.md §5.3). One rule, used by
// the /account page and by the download route.
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type AccountUser = { id: string; email: string; emailVerified: boolean };

// Orders bought while signed in carry the user's id. A guest order only has
// the email the buyer typed in Stripe Checkout, so it counts as the user's
// only if Google has verified that the user owns this email (PLAN.md §10,
// item 12). Upper and lower case don't matter.
//
// Nothing is written to the database: a guest order stays a guest order,
// and its download link keeps working.
export function ownedOrdersWhere(user: AccountUser): Prisma.OrderWhereInput {
  if (!user.emailVerified) return { userId: user.id };
  return {
    OR: [
      { userId: user.id },
      { userId: null, email: { equals: user.email, mode: "insensitive" } },
    ],
  };
}

export async function userOwnsOrder(user: AccountUser, orderId: string) {
  const count = await db.order.count({
    where: { AND: [{ id: orderId }, ownedOrdersWhere(user)] },
  });
  return count === 1;
}

// For /account: paid and refunded orders, newest first. Orders that were
// never paid (PENDING, EXPIRED, FAILED) aren't shown.
export function getAccountOrders(user: AccountUser) {
  return db.order.findMany({
    where: {
      AND: [ownedOrdersWhere(user), { status: { in: ["PAID", "REFUNDED"] } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalCents: true,
      paidAt: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          beatTitleSnapshot: true,
          licenseNameSnapshot: true,
          priceCents: true,
          refundNeeded: true,
          downloads: {
            select: { fileType: true, count: true, maxCount: true },
            orderBy: { fileType: "asc" },
          },
        },
      },
    },
  });
}
