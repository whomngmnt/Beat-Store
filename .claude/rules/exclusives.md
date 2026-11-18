---
paths:
  - "src/lib/reservation.ts"
  - "src/lib/fulfilment.ts"
  - "src/actions/checkout.ts"
  - "src/app/api/cron/**"
  - "prisma/schema.prisma"
---

# Exclusive licenses and race conditions (PLAN.md §5.4)

- Reserve with **one conditional UPDATE**, inside the same transaction that creates the PENDING order:

  ```sql
  UPDATE "Beat"
  SET status = 'RESERVED', "reservedByOrderId" = $orderId, "reservedUntil" = now() + interval '35 minutes'
  WHERE id = $beatId
    AND (status = 'PUBLISHED' OR (status = 'RESERVED' AND "reservedUntil" < now()));
  ```

  1 row changed means reserved. 0 rows means someone else has it: roll back and show "this exclusive was just taken".
  The hold (35 min) outlasts the Stripe session (31 min), so it can't run out while the buyer can still pay.
- Never SELECT-then-UPDATE for reservations, download counts or coupon claims. Use one atomic conditional statement.
- Raw SQL goes through Prisma's tagged `$executeRaw` / `$queryRaw`, so values are parameters. Never build SQL strings by hand or use the `Unsafe` variants.
- RESERVED beats show "Reserved, check back soon" and can't be added to the cart as Exclusive. Leases stay purchasable.
- On payment: `UPDATE Beat SET status = SOLD WHERE id = ? AND reservedByOrderId = order.id`. If 0 rows change, refund that item automatically after commit.
- Release reservations on `checkout.session.expired`, and in a cron route that frees any reservation past `reservedUntil`.
- After an exclusive is refunded, the admin decides whether to re-list the beat.
- Test: 20 concurrent `createCheckoutSession` calls for one exclusive produce exactly 1 reservation, against a real Postgres.
