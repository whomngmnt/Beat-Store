// Frees exclusive holds that have run out (PLAN.md §5.2, step 9). The
// checkout.session.expired webhook normally does this. This is the safety
// net in case that event is lost.
//
// Called by a scheduled job with `Authorization: Bearer <CRON_SECRET>`
// (Vercel Cron sends that header). Not a page or action for people, so no
// requireAdmin(): the secret is the check.
import { releaseExpiredReservations } from "@/lib/reservation";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // An empty secret would let "Bearer " through, so it must be set.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const released = await releaseExpiredReservations();
  return Response.json({ released });
}
