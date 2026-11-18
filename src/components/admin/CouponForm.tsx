"use client";

// The new-coupon form on /admin/coupons. The server action
// (src/actions/coupons.ts) checks every field again.
import { createCoupon } from "@/actions/coupons";
import { Field, Message, useFormAction } from "@/components/admin/FormParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CouponForm() {
  const { result, onSubmit, pending } = useFormAction(createCoupon);
  const errors = result?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Code"
          id="code"
          errors={errors.code}
          hint="Buyers type it at checkout. Capitals don't matter."
        >
          <Input id="code" name="code" placeholder="SUMMER15" required />
        </Field>
        <Field
          label="Expires after"
          id="expiresOn"
          errors={errors.expiresOn}
          hint="Works to the end of this day (UTC). Empty: never expires."
        >
          <Input id="expiresOn" name="expiresOn" type="date" />
        </Field>
        <Field
          label="Percent off"
          id="percentOff"
          errors={errors.percentOff}
          hint="1 to 100. Fill in this or the amount, not both."
        >
          <Input
            id="percentOff"
            name="percentOff"
            type="number"
            min={1}
            max={100}
          />
        </Field>
        <Field
          label="Amount off (USD)"
          id="amountOff"
          errors={errors.amountOff}
          hint="Like 10 or 4.99."
        >
          <Input id="amountOff" name="amountOff" inputMode="decimal" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Create coupon
        </Button>
        <Message result={result} />
      </div>
    </form>
  );
}
