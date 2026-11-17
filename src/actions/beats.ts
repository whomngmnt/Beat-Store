"use server";

// Admin actions on beats (PLAN.md §3, §5.5): create and edit a beat, publish
// it or move it back to draft, set its license prices, and save an uploaded
// file once it passes the checks.
//
// A server action can be called by anyone who finds it, so each one calls
// requireAdmin() before anything else and checks its input with Zod.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma, type BeatStatus } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
  FILE_KINDS,
  checkUpload,
  fileRules,
  isUploadKey,
  publishProblems,
} from "@/lib/uploads";
import {
  beatFormSchema,
  invalidForm,
  priceField,
  type FormResult,
} from "@/lib/validators";

const FORM_FIELDS = [
  "title",
  "slug",
  "description",
  "bpm",
  "musicalKey",
  "genre",
  "mood",
  "tags",
  "featured",
] as const;

function readBeatForm(formData: FormData) {
  return beatFormSchema.safeParse(
    Object.fromEntries(FORM_FIELDS.map((name) => [name, formData.get(name)])),
  );
}

// The slug column is unique. Prisma reports a second beat with the same
// slug as error P2002.
function isSlugTaken(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const slugTaken: FormResult = {
  ok: false,
  message: "Check the fields marked below.",
  fieldErrors: { slug: ["Another beat already uses this slug."] },
};

const notFound: FormResult = {
  ok: false,
  message: "This beat no longer exists.",
};

// A new beat starts as a DRAFT, with every license tier on at its default
// price. Files are uploaded on its edit page, because their keys include
// the beat's id.
export async function createBeat(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const input = readBeatForm(formData);
  if (!input.success) return invalidForm(input.error);

  const tiers = await db.licenseTier.findMany();
  let beatId: string;
  try {
    const beat = await db.beat.create({
      data: {
        ...input.data,
        status: "DRAFT",
        licenses: {
          create: tiers.map((tier) => ({
            licenseTierId: tier.id,
            priceCents: tier.defaultPriceCents,
          })),
        },
      },
      select: { id: true },
    });
    beatId = beat.id;
  } catch (error) {
    if (isSlugTaken(error)) return slugTaken;
    throw error;
  }
  // Outside the try: redirect() works by throwing.
  redirect(`/admin/beats/${beatId}`);
}

export async function updateBeat(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const beatId = z.uuid().safeParse(formData.get("beatId"));
  if (!beatId.success) return notFound;
  const input = readBeatForm(formData);
  if (!input.success) return invalidForm(input.error);

  try {
    const { count } = await db.beat.updateMany({
      where: { id: beatId.data },
      data: input.data,
    });
    if (count === 0) return notFound;
  } catch (error) {
    if (isSlugTaken(error)) return slugTaken;
    throw error;
  }
  refresh();
  return { ok: true, message: "Saved." };
}

// The files and licenses publishProblems() looks at.
const publishCheckSelect = {
  status: true,
  previewKey: true,
  mp3Key: true,
  wavKey: true,
  stemsKey: true,
  licenses: {
    select: {
      id: true,
      active: true,
      licenseTier: {
        select: {
          name: true,
          includesMp3: true,
          includesWav: true,
          includesStems: true,
        },
      },
    },
  },
} as const;

const statusSchema = z.object({
  beatId: z.uuid(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

// PUBLISHED needs every file the active licenses include (publishProblems).
// A SOLD beat can be published again: after an exclusive is refunded, the
// admin decides whether to re-list it. A RESERVED beat never changes here,
// because a checkout is holding it.
export async function setBeatStatus(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const input = statusSchema.safeParse({
    beatId: formData.get("beatId"),
    status: formData.get("status"),
  });
  if (!input.success) return { ok: false, message: "Unknown status." };
  const { beatId, status } = input.data;

  const beat = await db.beat.findUnique({
    where: { id: beatId },
    select: publishCheckSelect,
  });
  if (!beat) return notFound;
  if (status === "PUBLISHED") {
    const problems = publishProblems(beat, beat.licenses);
    if (problems.length > 0) {
      return { ok: false, message: `Can't publish yet. ${problems.join(" ")}` };
    }
  }

  // One conditional UPDATE, so a checkout that reserves the beat at the same
  // moment can't be overwritten. Re-listing a sold beat clears its old
  // reservation.
  const from: BeatStatus[] =
    status === "PUBLISHED" ? ["DRAFT", "SOLD"] : ["PUBLISHED", "SOLD"];
  const { count } = await db.beat.updateMany({
    where: { id: beatId, status: { in: from } },
    data: { status, reservedByOrderId: null, reservedUntil: null },
  });
  if (count === 0) {
    return {
      ok: false,
      message:
        beat.status === "RESERVED"
          ? "A checkout is holding this exclusive right now. Try again when it's paid or expired."
          : `This beat is already ${beat.status}.`,
    };
  }
  refresh();
  return { ok: true, message: `The beat is now ${status}.` };
}

// Prices and on/off for each of the beat's licenses. Fields are named
// price-<beatLicenseId> and active-<beatLicenseId>. Past orders keep their
// own price snapshot, so they never change.
export async function updateBeatPrices(
  _previous: FormResult | undefined,
  formData: FormData,
): Promise<FormResult> {
  await requireAdmin();
  const beatId = z.uuid().safeParse(formData.get("beatId"));
  if (!beatId.success) return notFound;

  const beat = await db.beat.findUnique({
    where: { id: beatId.data },
    select: publishCheckSelect,
  });
  if (!beat) return notFound;

  const changes = [];
  for (const license of beat.licenses) {
    const price = priceField.safeParse(
      String(formData.get(`price-${license.id}`) ?? ""),
    );
    if (!price.success) {
      return {
        ok: false,
        message: `${license.licenseTier.name}: ${price.error.issues[0].message}`,
      };
    }
    const active = formData.get(`active-${license.id}`) === "on";
    changes.push({ ...license, priceCents: price.data, active });
  }

  // A published beat must stay publishable: no license turned on without
  // its files, and at least one license left on.
  if (beat.status === "PUBLISHED") {
    const problems = publishProblems(beat, changes);
    if (problems.length > 0) {
      return {
        ok: false,
        message: `Not saved: the beat is published. ${problems.join(" ")}`,
      };
    }
  }

  await db.$transaction(
    changes.map((change) =>
      db.beatLicense.update({
        where: { id: change.id },
        data: { priceCents: change.priceCents, active: change.active },
      }),
    ),
  );
  refresh();
  return { ok: true, message: "Prices saved." };
}

const attachSchema = z.object({
  beatId: z.uuid(),
  kind: z.enum(FILE_KINDS),
  key: z.string().max(200),
});

// Called by the browser after it PUT a file to the link from /api/upload.
// The file is checked (size and magic bytes) before its key is saved on the
// beat. One that fails is deleted and never saved. The beat's earlier file
// of this kind stays in storage, unused.
export async function attachBeatFile(
  beatId: unknown,
  kind: unknown,
  key: unknown,
): Promise<FormResult> {
  await requireAdmin();
  const input = attachSchema.safeParse({ beatId, kind, key });
  if (
    !input.success ||
    !isUploadKey(input.data.key, input.data.beatId, input.data.kind)
  ) {
    return { ok: false, message: "Unknown upload." };
  }

  const problem = await checkUpload(input.data.kind, input.data.key);
  if (problem) return { ok: false, message: problem };

  const rule = fileRules[input.data.kind];
  const { count } = await db.beat.updateMany({
    where: { id: input.data.beatId },
    data: { [rule.column]: input.data.key },
  });
  if (count === 0) return notFound;
  refresh();
  return { ok: true, message: `The ${rule.label} is saved.` };
}
