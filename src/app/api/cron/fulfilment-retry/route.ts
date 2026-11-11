// Retries the side effects that run after fulfilment (PLAN.md §5.2,
// step 7). In v1 that's only the refund of a lost exclusive. Receipt
// emails and license PDFs join this with their later slices.
//
// Called by a scheduled job with `Authorization: Bearer <CRON_SECRET>`
// (Vercel Cron sends that header). Not a page or action for people, so no
// requireAdmin(): the secret is the check.
import { refundLostExclusives } from "@/lib/fulfilment";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // An empty secret would let "Bearer " through, so it must be set.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const refunded = await refundLostExclusives();
  return Response.json({ refunded });
}
