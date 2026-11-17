"use client";

// The two forms on the admin order page that show an answer after they're
// sent: the refund (Stripe's reply) and the new guest download link.
// Client components only because useActionState keeps that answer. The
// actions themselves run on the server (src/actions/orders.ts).
import { useActionState } from "react";
import { reissueGuestLink, refundOrder } from "@/actions/orders";
import { Button } from "@/components/ui/button";

function Result({ result }: { result?: { ok: boolean; message: string } }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={result.ok ? "text-sm" : "text-sm text-destructive"}
    >
      {result.message}
    </p>
  );
}

// The box must be ticked, so one stray click can't refund an order.
export function RefundForm({
  orderId,
  amount,
}: {
  orderId: string;
  amount: string;
}) {
  const [result, action, pending] = useActionState(refundOrder, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required />
        Refund {amount} to the buyer
      </label>
      <Button type="submit" variant="destructive" disabled={pending}>
        Refund order
      </Button>
      <Result result={result} />
    </form>
  );
}

// On success the message is the new link. It's shown only here, once:
// only its hash is stored, so it can't be shown again later.
export function ReissueLinkForm({ orderId }: { orderId: string }) {
  const [result, action, pending] = useActionState(reissueGuestLink, undefined);

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Button type="submit" variant="outline" disabled={pending}>
        Make a new guest download link
      </Button>
      {result?.ok ? (
        <div className="flex w-full flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            Send this link to the buyer. The old link no longer works.
          </p>
          <input
            readOnly
            value={result.message}
            aria-label="New download link"
            onFocus={(event) => event.target.select()}
            className="w-full rounded-md border bg-transparent px-2 py-1 font-mono text-xs"
          />
        </div>
      ) : (
        <Result result={result} />
      )}
    </form>
  );
}
