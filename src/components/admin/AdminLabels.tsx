// Small pieces shared by the admin pages: status badges and dates.
import { Badge } from "@/components/ui/badge";
import type { BeatStatus, OrderStatus } from "@/generated/prisma/client";

const orderVariant = {
  PAID: "default",
  PENDING: "secondary",
  EXPIRED: "outline",
  FAILED: "destructive",
  REFUNDED: "destructive",
} as const satisfies Record<OrderStatus, string>;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={orderVariant[status]}>{status}</Badge>;
}

const beatVariant = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  RESERVED: "outline",
  SOLD: "outline",
} as const satisfies Record<BeatStatus, string>;

export function BeatStatusBadge({ status }: { status: BeatStatus }) {
  return <Badge variant={beatVariant[status]}>{status}</Badge>;
}

// Dates in UTC, the database's time zone, so they read the same for
// everyone and match the database.
export function UtcDate({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()}>
      {date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      })}
    </time>
  );
}
