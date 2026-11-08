import Form from "next/form";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { FilterOptions } from "@/lib/catalog";
import type { CatalogFilters } from "@/lib/validators";

const sortLabels: Record<CatalogFilters["sort"], string> = {
  newest: "Newest",
  popular: "Most played",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

type Props = { filters: CatalogFilters; options: FilterOptions };

// A plain GET form: submitting it puts the fields in the URL
// (/beats?genre=Trap&sort=popular), and the page reads them from there.
// next/form makes that a client-side navigation. It has no page field, so
// applying filters always goes back to page 1.
export function BeatFilters({ filters, options }: Props) {
  return (
    // The inputs only read their starting value on mount. The key re-mounts
    // the form when the filters change (Clear, back button), so the inputs
    // always show what's in the URL.
    <Form
      key={JSON.stringify(filters)}
      action="/beats"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Search
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Title or tag"
          maxLength={100}
        />
      </label>
      <FilterSelect
        label="Genre"
        name="genre"
        value={filters.genre}
        choices={options.genres}
      />
      <FilterSelect
        label="Mood"
        name="mood"
        value={filters.mood}
        choices={options.moods}
      />
      <FilterSelect
        label="Key"
        name="key"
        value={filters.key}
        choices={options.keys}
      />
      <NumberField
        label="Min BPM"
        name="bpmMin"
        value={filters.bpmMin}
        max={300}
      />
      <NumberField
        label="Max BPM"
        name="bpmMax"
        value={filters.bpmMax}
        max={300}
      />
      <NumberField
        label="Max price ($)"
        name="maxPrice"
        value={filters.maxPrice}
        max={100_000}
      />

      <label className="flex flex-col gap-1 text-sm">
        Sort
        <NativeSelect
          name="sort"
          defaultValue={filters.sort}
          className="w-full"
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit">Apply</Button>
        <Link href="/beats" className={buttonVariants({ variant: "ghost" })}>
          Clear
        </Link>
      </div>
    </Form>
  );
}

function FilterSelect(props: {
  label: string;
  name: string;
  value?: string;
  choices: string[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {props.label}
      <NativeSelect
        name={props.name}
        defaultValue={props.value ?? ""}
        className="w-full"
      >
        <NativeSelectOption value="">Any</NativeSelectOption>
        {props.choices.map((choice) => (
          <NativeSelectOption key={choice} value={choice}>
            {choice}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

function NumberField(props: {
  label: string;
  name: string;
  value?: number;
  max: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {props.label}
      <Input
        type="number"
        name={props.name}
        defaultValue={props.value}
        min={1}
        max={props.max}
        step={1}
        inputMode="numeric"
      />
    </label>
  );
}
