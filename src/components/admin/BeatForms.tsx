"use client";

// The forms on the admin beat pages. Each one sends its fields to a server
// action (src/actions/beats.ts), which checks everything again, and shows
// the answer. Client components only because they keep that answer.
import {
  createBeat,
  setBeatStatus,
  updateBeat,
  updateBeatPrices,
} from "@/actions/beats";
import {
  Field,
  Message,
  textareaClass,
  useFormAction,
} from "@/components/admin/FormParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type BeatFormValues = {
  id: string;
  title: string;
  slug: string;
  description: string;
  bpm: number;
  musicalKey: string;
  genre: string;
  mood: string;
  tags: string[];
  featured: boolean;
};

// Create a beat (no `beat`) or edit one.
export function BeatDetailsForm({ beat }: { beat?: BeatFormValues }) {
  const { result, onSubmit, pending } = useFormAction(
    beat ? updateBeat : createBeat,
  );
  const errors = result?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {beat && <input type="hidden" name="beatId" value={beat.id} />}
      <Field label="Title" id="title" errors={errors.title}>
        <Input id="title" name="title" defaultValue={beat?.title} required />
      </Field>
      <Field
        label="Slug"
        id="slug"
        errors={errors.slug}
        hint="The address: /beats/<slug>. Left empty, it's made from the title."
      >
        <Input id="slug" name="slug" defaultValue={beat?.slug} />
      </Field>
      <Field
        label="Description"
        id="description"
        errors={errors.description}
        hint="Plain text. Line breaks are kept; HTML is shown as text."
      >
        <textarea
          id="description"
          name="description"
          defaultValue={beat?.description}
          rows={4}
          className={textareaClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="BPM" id="bpm" errors={errors.bpm}>
          <Input
            id="bpm"
            name="bpm"
            type="number"
            min={40}
            max={300}
            defaultValue={beat?.bpm}
            required
          />
        </Field>
        <Field label="Key" id="musicalKey" errors={errors.musicalKey}>
          <Input
            id="musicalKey"
            name="musicalKey"
            placeholder="C minor"
            defaultValue={beat?.musicalKey}
            required
          />
        </Field>
        <Field label="Genre" id="genre" errors={errors.genre}>
          <Input id="genre" name="genre" defaultValue={beat?.genre} required />
        </Field>
        <Field label="Mood" id="mood" errors={errors.mood}>
          <Input id="mood" name="mood" defaultValue={beat?.mood} required />
        </Field>
      </div>
      <Field
        label="Tags"
        id="tags"
        errors={errors.tags}
        hint="Separated by commas, up to 10."
      >
        <Input id="tags" name="tags" defaultValue={beat?.tags.join(", ")} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={beat?.featured}
        />
        Featured on the home page
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {beat ? "Save details" : "Create beat"}
        </Button>
        <Message result={result} />
      </div>
    </form>
  );
}

// Publish, re-list (a SOLD beat) or move back to draft. Only the buttons
// that make sense are shown; the action checks again either way.
export function BeatStatusForm({
  beatId,
  status,
}: {
  beatId: string;
  status: "DRAFT" | "PUBLISHED" | "RESERVED" | "SOLD";
}) {
  const { result, onSubmit, pending } = useFormAction(setBeatStatus);

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-2">
      <input type="hidden" name="beatId" value={beatId} />
      {status === "RESERVED" ? (
        <p className="text-sm text-muted-foreground">
          A checkout is holding this exclusive. The status can change again once
          it&apos;s paid or expired.
        </p>
      ) : (
        <div className="flex gap-2">
          {status !== "PUBLISHED" && (
            <Button
              type="submit"
              name="status"
              value="PUBLISHED"
              disabled={pending}
            >
              {status === "SOLD" ? "Re-list (publish again)" : "Publish"}
            </Button>
          )}
          {status !== "DRAFT" && (
            <Button
              type="submit"
              name="status"
              value="DRAFT"
              variant="outline"
              disabled={pending}
            >
              Move to draft
            </Button>
          )}
        </div>
      )}
      <Message result={result} />
    </form>
  );
}

export type BeatPriceRow = {
  id: string; // the BeatLicense id
  name: string;
  price: string; // dollars, like "29.99"
  active: boolean;
};

export function BeatPricesForm({
  beatId,
  licenses,
}: {
  beatId: string;
  licenses: BeatPriceRow[];
}) {
  const { result, onSubmit, pending } = useFormAction(updateBeatPrices);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="beatId" value={beatId} />
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">License</th>
            <th className="py-1 font-medium">Price (USD)</th>
            <th className="py-1 font-medium">On sale</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((license) => (
            <tr key={license.id}>
              <td className="py-1 pr-3">{license.name}</td>
              <td className="py-1 pr-3">
                <Input
                  name={`price-${license.id}`}
                  defaultValue={license.price}
                  inputMode="decimal"
                  aria-label={`${license.name} price in dollars`}
                  className="max-w-32"
                  required
                />
              </td>
              <td className="py-1">
                <input
                  type="checkbox"
                  name={`active-${license.id}`}
                  defaultChecked={license.active}
                  aria-label={`${license.name} on sale`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Save prices
        </Button>
        <Message result={result} />
      </div>
    </form>
  );
}
