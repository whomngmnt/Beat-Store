---
paths:
  - "src/lib/stripe.ts"
  - "src/lib/fulfilment.ts"
  - "src/lib/pricing.ts"
  - "src/actions/checkout.ts"
  - "src/app/api/webhooks/**"
  - "src/app/api/cron/**"
  - "src/app/**/checkout/**"
  - "src/app/**/cart/**"
---

# Stripe checkout and fulfilment (PLAN.md §5.2)

Test mode only: `sk_test_` / `pk_test_` keys and no live-mode code paths. The site shows a "TEST MODE — no real payments" banner.

## Creating the session

- `createCheckoutSession` re-reads every price from the DB and checks that each beat is PUBLISHED.
- In one transaction, create the PENDING order and reserve any exclusive (see `exclusives.md`).
- The session gets `metadata.orderId` and `expires_at` = now + 30 min. If Stripe fails, release the reservation and mark the order FAILED.

## Webhook (`POST /api/webhooks/stripe`)

- Read the raw body with `await req.text()` (never `req.json()`) and verify it with `stripe.webhooks.constructEvent`. Return 400 if verification fails.
- Fulfil only when `payment_status === "paid"` **and** `amount_total` and `currency` match the order. Otherwise log, flag the order for review and don't fulfil.
- Idempotency is `INSERT WebhookEvent(id = event.id)` **inside** the fulfilment transaction. A unique violation means "already done", so return 200. Never check-then-process.
- `checkout.session.expired`: release reservations, order becomes EXPIRED. `charge.refunded`: order becomes REFUNDED, downloads disabled.

## Fulfilment (`src/lib/fulfilment.ts`)

- The transaction touches **only the database**: the WebhookEvent insert, order to PAID (`WHERE status = PENDING`), exclusive to SOLD, and the Download rows.
- Side effects run **after commit**, must be safe to re-run, and are retried by cron. In v1 that means the automatic refund (idempotency key `refund-<orderItemId>`). Email and PDF arrive with their later slices.
- The webhook still returns 200 if a side effect fails, because the payment is already recorded.

## Success page

- `session_id` in the URL is only a lookup key. Never trust URL parameters for payment status, order ID or amount.
- Look up the order by `stripeSessionId`. Then, **on the server**, retrieve the Checkout Session from Stripe and confirm that `payment_status === "paid"`, that `metadata.orderId` is this order, and that amount and currency match. Only then, if the webhook hasn't arrived yet, run the same idempotent `fulfilOrder()`.
- Always show the downloads and the bookmarkable guest link. Delivery never depends on email.

## Tests

- Duplicate and concurrent webhook deliveries produce exactly one fulfilment. Test this against a real Postgres, not mocks.
- A tampered body or a mismatched amount is not fulfilled.
- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline), `4000 0025 0000 3155` (3-D Secure).
