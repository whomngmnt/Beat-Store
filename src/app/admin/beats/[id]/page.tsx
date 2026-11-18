import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BeatStatusBadge } from "@/components/admin/AdminLabels";
import { BeatFileUpload } from "@/components/admin/BeatFileUpload";
import {
  BeatDetailsForm,
  BeatPricesForm,
  BeatStatusForm,
} from "@/components/admin/BeatForms";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/pricing";
import { publicUrl } from "@/lib/storage";
import { FILE_KINDS, fileRules, publishProblems } from "@/lib/uploads";

export const metadata: Metadata = { title: "Edit beat" };

// Everything about one beat (PLAN.md §3, §5.5): details, files, license
// prices, and publishing. Publishing needs the files the active licenses
// include, so the page lists what's still missing.
export default async function EditBeatPage({
  params,
}: PageProps<"/admin/beats/[id]">) {
  await requireAdmin();

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const beat = await db.beat.findUnique({
    where: { id: id.data },
    include: {
      licenses: {
        include: { licenseTier: true },
        orderBy: { licenseTier: { sortOrder: "asc" } },
      },
    },
  });
  if (!beat) notFound();

  const problems = publishProblems(beat, beat.licenses);
  // What the file input accepts: the allowed types and their extensions.
  const accept = (kind: (typeof FILE_KINDS)[number]) => {
    const types = fileRules[kind].types;
    const extensions = new Set(Object.values(types).map((ext) => `.${ext}`));
    return [...Object.keys(types), ...extensions].join(",");
  };

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-1">
        <Link href="/admin/beats" className="text-sm text-muted-foreground">
          ← Beats
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold">{beat.title}</h1>
          <BeatStatusBadge status={beat.status} />
        </div>
        {beat.status !== "DRAFT" && (
          <Link
            href={`/beats/${beat.slug}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            View in the store
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Status</h2>
        {beat.status !== "PUBLISHED" && problems.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <BeatStatusForm beatId={beat.id} status={beat.status} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Files</h2>
        <p className="text-sm text-muted-foreground">
          Covers and previews are public. Make the preview with{" "}
          <code>pnpm make-preview</code> (tagged, 128 kbps). Full files are
          private and only reach buyers through download links.
        </p>
        {FILE_KINDS.map((kind) => {
          const rule = fileRules[kind];
          const key = beat[rule.column];
          return (
            <BeatFileUpload
              key={kind}
              beatId={beat.id}
              kind={kind}
              label={rule.label}
              accept={accept(kind)}
            >
              {!key ? (
                <p className="text-sm text-muted-foreground">Not uploaded.</p>
              ) : kind === "cover" ? (
                // next/image sends a 160 px copy (320 px on a sharp screen).
                <Image
                  src={publicUrl(key)}
                  alt=""
                  width={160}
                  height={160}
                  className="rounded-md object-cover"
                />
              ) : kind === "preview" ? (
                <audio controls preload="none" src={publicUrl(key)} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Uploaded (private).
                </p>
              )}
            </BeatFileUpload>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Licenses and prices</h2>
        <p className="text-sm text-muted-foreground">
          New beats start at the license defaults. Changes apply to new
          checkouts; past orders keep the price they paid.
        </p>
        <BeatPricesForm
          beatId={beat.id}
          licenses={beat.licenses.map((license) => ({
            id: license.id,
            name: license.licenseTier.name,
            price: centsToDollars(license.priceCents),
            active: license.active,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Details</h2>
        <BeatDetailsForm
          beat={{
            id: beat.id,
            title: beat.title,
            slug: beat.slug,
            description: beat.description,
            bpm: beat.bpm,
            musicalKey: beat.musicalKey,
            genre: beat.genre,
            mood: beat.mood,
            tags: beat.tags,
            featured: beat.featured,
          }}
        />
      </section>
    </div>
  );
}
