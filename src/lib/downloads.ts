// Admin fixes for downloads (PLAN.md §5.1, .claude/rules/downloads.md):
// give a buyer their downloads back, or a new link.
//
// Plain server functions, not server actions: a server action can be
// called by anyone, and requireAdmin() arrives with auth in Phase 7. The
// admin order page (Phase 8) calls these from an action that checks
// requireAdmin() first.
import { db } from "@/lib/db";
import { createDownloadToken } from "@/lib/tokens";

// Sets one file's download count back to 0. False if there's no such row.
export async function resetDownloadCount(downloadId: string) {
  const { count } = await db.download.updateMany({
    where: { id: downloadId },
    data: { count: 0 },
  });
  return count === 1;
}

// Replaces the order's guest token, so the old link stops working, and
// returns the new download link (the success page with the new token) for
// the admin to send to the buyer. Null if the order never reached Stripe,
// because the success page finds orders by their Stripe session id.
export async function reissueDownloadToken(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { stripeSessionId: true },
  });
  if (!order?.stripeSessionId) return null;

  const download = createDownloadToken();
  await db.order.update({
    where: { id: orderId },
    data: {
      downloadTokenHash: download.hash,
      downloadTokenExpiresAt: download.expiresAt,
    },
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/checkout/success?session_id=${order.stripeSessionId}&token=${download.token}`;
}
