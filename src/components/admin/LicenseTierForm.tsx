"use client";

// One license tier's template on /admin/licenses. The server action
// (src/actions/licenses.ts) checks every field again.
import { updateLicenseTier } from "@/actions/licenses";
import {
  Field,
  Message,
  textareaClass,
  useFormAction,
} from "@/components/admin/FormParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LicenseTierValues = {
  id: string;
  name: string;
  description: string;
  defaultPrice: string; // dollars, like "29.99"
  streamLimit: number | null;
  videoLimit: number | null;
  terms: string;
};

export function LicenseTierForm({ tier }: { tier: LicenseTierValues }) {
  const { result, onSubmit, pending } = useFormAction(updateLicenseTier);
  const errors = result?.fieldErrors ?? {};
  // Ids must be unique on the page, which has one form per tier.
  const id = (field: string) => `${field}-${tier.id}`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="tierId" value={tier.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" id={id("name")} errors={errors.name}>
          <Input
            id={id("name")}
            name="name"
            defaultValue={tier.name}
            required
          />
        </Field>
        <Field
          label="Default price (USD)"
          id={id("defaultPrice")}
          errors={errors.defaultPrice}
          hint="New beats start at this price. Existing beats keep theirs."
        >
          <Input
            id={id("defaultPrice")}
            name="defaultPrice"
            defaultValue={tier.defaultPrice}
            inputMode="decimal"
            required
          />
        </Field>
        <Field
          label="Stream limit"
          id={id("streamLimit")}
          errors={errors.streamLimit}
          hint="Empty means unlimited."
        >
          <Input
            id={id("streamLimit")}
            name="streamLimit"
            type="number"
            min={1}
            defaultValue={tier.streamLimit ?? ""}
          />
        </Field>
        <Field
          label="Video limit"
          id={id("videoLimit")}
          errors={errors.videoLimit}
          hint="Empty means unlimited."
        >
          <Input
            id={id("videoLimit")}
            name="videoLimit"
            type="number"
            min={1}
            defaultValue={tier.videoLimit ?? ""}
          />
        </Field>
      </div>
      <Field
        label="Short description"
        id={id("description")}
        errors={errors.description}
      >
        <Input
          id={id("description")}
          name="description"
          defaultValue={tier.description}
          required
        />
      </Field>
      <Field
        label="Terms"
        id={id("terms")}
        errors={errors.terms}
        hint="Plain text, shown on the beat page when this license is picked."
      >
        <textarea
          id={id("terms")}
          name="terms"
          defaultValue={tier.terms}
          rows={4}
          required
          className={textareaClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save {tier.name}
        </Button>
        <Message result={result} />
      </div>
    </form>
  );
}
