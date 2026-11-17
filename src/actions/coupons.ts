"use server";

// Coupons (PLAN.md §3, §4): the admin creates a code, turns it on or off,
// and deletes one nobody has used. A coupon's discount can't be edited:
// make a new code instead, so a code always meant one thing. Each action
// calls requireAdmin() first.
import { refresh } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  couponFormSchema,
  invalidForm,
  type FormResult,
} from "@/lib/validators";

export async function createCoupon(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const input = couponFormSchema.safeParse({
    code: formData.get("code"),
    percentOff: formData.get("percentOff"),
    amountOff: formData.get("amountOff"),
    expiresOn: formData.get("expiresOn"),
  });
  if (!input.success) return invalidForm(input.error);

  try {
    await db.coupon.create({ data: input.data });
  } catch (error) {
    // The code column is unique.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Check the fields marked below.",
        fieldErrors: { code: ["This code already exists."] },
      };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: `${input.data.code} is ready to use.` };
}

const toggleSchema = z.object({
  couponId: z.uuid(),
  active: z.enum(["true", "false"]),
});

// A plain <form action>: the list re-renders with the new state.
export async function setCouponActive(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = toggleSchema.safeParse({
    couponId: formData.get("couponId"),
    active: formData.get("active"),
  });
  if (!input.success) return;
  await db.coupon.updateMany({
    where: { id: input.data.couponId },
    data: { active: input.data.active === "true" },
  });
  refresh();
}

// Only a coupon no order points at, so past orders keep their coupon.
// A used coupon can be turned off instead.
export async function deleteCoupon(formData: FormData): Promise<void> {
  await requireAdmin();
  const couponId = z.uuid().safeParse(formData.get("couponId"));
  if (!couponId.success) return;
  await db.coupon.deleteMany({
    where: { id: couponId.data, orders: { none: {} } },
  });
  refresh();
}
