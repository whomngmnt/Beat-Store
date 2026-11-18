// The admin order actions (src/actions/orders.ts) against the real
// database. Stripe's refund call is faked, so nothing reaches Stripe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  refundOrder,
  reissueGuestLink,
  resetDownload,
} from "../../src/actions/orders";
import type { OrderStatus } from "../../src/generated/prisma/client";
import { getCurrentUser } from "../../src/lib/auth-guards"; // faked in setup.ts
import { db } from "../../src/lib/db";
import { getStripe } from "../../src/lib/stripe";
import { tokenMatches } from "../../src/lib/tokens";
import {
  createTestBeat,
  createTestUser,
  deleteTestBeat,
  deleteTestUser,
  fakeStripeId,
} from "./fixtures";

// refresh() only works inside a real Next request.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

let beat: Awaited<ReturnType<typeof createTestBeat>>;
let userIds: string[];

beforeEach(async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null); // signed out
  vi.spyOn(getStripe().refunds, "create").mockResolvedValue(
    {} as Awaited<
      ReturnType<ReturnType<typeof getStripe>["refunds"]["create"]>
    >,
  );
  userIds = [];
  beat = await createTestBeat();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await deleteTestBeat(beat.beatId); // the orders go first
  for (const id of userIds) await deleteTestUser(id);
});

async function signIn(role: "USER" | "ADMIN") {
  const user = await createTestUser(true);
  userIds.push(user.id);
  const withRole = await db.user.update({
    where: { id: user.id },
    data: { role },
  });
  vi.mocked(getCurrentUser).mockResolvedValue(withRole);
}

// An order for the test beat (Premium lease) with its MP3 and WAV rows.
async function testOrder(status: OrderStatus = "PAID") {
  const tier = beat.tier("PREMIUM");
  return db.order.create({
    data: {
      status,
      totalCents: tier.defaultPriceCents,
      stripeSessionId: fakeStripeId("cs"),
      stripePaymentIntentId: status === "PAID" ? fakeStripeId("pi") : null,
      items: {
        create: {
          beatId: beat.beatId,
          licenseTierId: tier.id,
          priceCents: tier.defaultPriceCents,
          beatTitleSnapshot: "Integration test beat",
          licenseNameSnapshot: tier.name,
          downloads: {
            create: [{ fileType: "MP3", count: 5 }, { fileType: "WAV" }],
          },
        },
      },
    },
    include: { items: { include: { downloads: true } } },
  });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("admin order actions", () => {
  it("send a signed-out visitor to sign in, and a non-admin home", async () => {
    const order = await testOrder();
    const orderForm = form({ orderId: order.id, confirm: "on" });
    const downloadForm = form({
      downloadId: order.items[0].downloads[0].id,
    });

    for (const expected of ["redirect to /sign-in", "redirect to /"]) {
      if (expected === "redirect to /") await signIn("USER");
      await expect(refundOrder(undefined, orderForm)).rejects.toThrow(expected);
      await expect(reissueGuestLink(undefined, orderForm)).rejects.toThrow(
        expected,
      );
      await expect(resetDownload(downloadForm)).rejects.toThrow(expected);
    }
    expect(getStripe().refunds.create).not.toHaveBeenCalled();
  });

  it("refund a paid order once through Stripe, with an idempotency key", async () => {
    await signIn("ADMIN");
    const order = await testOrder();

    const result = await refundOrder(
      undefined,
      form({ orderId: order.id, confirm: "on" }),
    );

    expect(result.ok).toBe(true);
    expect(getStripe().refunds.create).toHaveBeenCalledOnce();
    expect(getStripe().refunds.create).toHaveBeenCalledWith(
      { payment_intent: order.stripePaymentIntentId },
      { idempotencyKey: `refund-order-${order.id}` },
    );
    // REFUNDED comes from the charge.refunded webhook, not from the action.
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
  });

  it("won't refund without the confirm box, or an order that isn't paid", async () => {
    await signIn("ADMIN");
    const paid = await testOrder();
    const pending = await testOrder("PENDING");

    const unconfirmed = await refundOrder(
      undefined,
      form({ orderId: paid.id }),
    );
    const notPaid = await refundOrder(
      undefined,
      form({ orderId: pending.id, confirm: "on" }),
    );

    expect(unconfirmed.ok).toBe(false);
    expect(notPaid).toEqual({
      ok: false,
      message: "Only a paid order can be refunded.",
    });
    expect(getStripe().refunds.create).not.toHaveBeenCalled();
  });

  it("report a refund that Stripe refuses", async () => {
    await signIn("ADMIN");
    const order = await testOrder();
    vi.mocked(getStripe().refunds.create).mockRejectedValueOnce(
      new Error("charge already refunded"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await refundOrder(
      undefined,
      form({ orderId: order.id, confirm: "on" }),
    );

    expect(result.ok).toBe(false);
  });

  it("reset a file's download count to 0", async () => {
    await signIn("ADMIN");
    const order = await testOrder();
    const mp3 = order.items[0].downloads.find((d) => d.fileType === "MP3");

    await resetDownload(form({ downloadId: mp3!.id }));

    const after = await db.download.findUniqueOrThrow({
      where: { id: mp3!.id },
    });
    expect(after.count).toBe(0);
  });

  it("make a new guest link whose token matches the order", async () => {
    await signIn("ADMIN");
    const order = await testOrder();

    const result = await reissueGuestLink(
      undefined,
      form({ orderId: order.id }),
    );

    expect(result.ok).toBe(true);
    const token = new URL(result.message).searchParams.get("token");
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(
      tokenMatches(
        token!,
        after.downloadTokenHash,
        after.downloadTokenExpiresAt,
      ),
    ).toBe(true);
  });
});
