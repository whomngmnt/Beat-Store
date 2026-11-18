// Downloads a bought file (PLAN.md §5.1, .claude/rules/downloads.md):
// GET /api/download/<orderItemId>/<MP3|WAV|STEMS>?token=<guest token>
//
// Two ways in: the order's guest token (the success page's links), or being
// signed in as the order's owner (the /account page's links, which have no
// token). No requireUser(), because guests buy without an account.
import { userOwnsOrder } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { signDownloadUrl } from "@/lib/storage";
import { tokenMatches } from "@/lib/tokens";
import { downloadParamsSchema, downloadTokenSchema } from "@/lib/validators";

const extensions = { MP3: ".mp3", WAV: ".wav", STEMS: ".zip" } as const;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/download/[orderItemId]/[fileType]">,
) {
  const params = downloadParamsSchema.safeParse(await ctx.params);
  if (!params.success) return reply(404, "Not found");
  const { orderItemId, fileType } = params.data;
  const token = downloadTokenSchema.safeParse(
    new URL(request.url).searchParams.get("token"),
  );

  const item = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      orderId: true,
      refundNeeded: true,
      order: {
        select: {
          status: true,
          downloadTokenHash: true,
          downloadTokenExpiresAt: true,
        },
      },
      beat: {
        select: { slug: true, mp3Key: true, wavKey: true, stemsKey: true },
      },
      downloads: { where: { fileType }, select: { id: true } },
    },
  });

  // 1. A token that belongs to this item's order and hasn't expired, or
  // else the signed-in owner. The session is only looked up when there's no
  // valid token. An unknown item gets the same 403, so the route doesn't
  // reveal which ids exist.
  const tokenOk =
    item !== null &&
    token.success &&
    tokenMatches(
      token.data,
      item.order.downloadTokenHash,
      item.order.downloadTokenExpiresAt,
    );
  if (!item || !(tokenOk || (await isSignedInOwner(item.orderId)))) {
    return reply(403, "This download link isn't valid or has expired.");
  }

  // 2. Paid and not refunded. A lost exclusive (refundNeeded) is paid for
  // but refunded, so it has no files.
  if (item.order.status !== "PAID" || item.refundNeeded) {
    return reply(403, "This order has no downloads.");
  }

  // The license must include this file (fulfilment made a Download row for
  // each one it includes), and the file must be uploaded. Both are checked
  // before counting, so a failed request doesn't use up a download.
  const download = item.downloads[0];
  if (!download) return reply(404, "This license doesn't include this file.");
  const key = {
    MP3: item.beat.mp3Key,
    WAV: item.beat.wavKey,
    STEMS: item.beat.stemsKey,
  }[fileType];
  if (!key) {
    return reply(404, "This file isn't available yet. Please contact support.");
  }

  // Sign the 10-minute link first (offline, nothing reaches storage): if
  // signing fails, for example because storage isn't configured, the error
  // happens before the count, so the buyer doesn't lose a download.
  const filename = `${item.beat.slug}${fileType === "STEMS" ? "-stems" : ""}${extensions[fileType]}`;
  const url = await signDownloadUrl(key, filename);

  // 3. Count it in one statement: two requests at once can't both take the
  // last download, because Postgres checks `count < maxCount` on the row
  // as it updates it.
  const counted = await db.$executeRaw`
    UPDATE "Download"
    SET count = count + 1, "lastAt" = now()
    WHERE id = ${download.id} AND count < "maxCount"`;
  if (counted === 0) {
    return reply(429, "Download limit reached. Please contact support.");
  }

  // 4. Only now hand out the signed link.
  return new Response(null, {
    status: 302,
    // no-store: the signed link stops working in 10 minutes, so no cache
    // may keep this redirect.
    headers: { Location: url, "Cache-Control": "no-store" },
  });
}

// The signed-in user owns the order, by the same rule as /account.
async function isSignedInOwner(orderId: string) {
  const user = await getCurrentUser();
  return user !== null && (await userOwnsOrder(user, orderId));
}

function reply(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
