// Upload links for the admin (PLAN.md §5.5, .claude/rules/uploads.md):
// POST /api/upload with { beatId, kind, contentType }
// → { url, key }: a 10-minute link the browser PUTs the file to.
//
// The server picks the key (uploads/<beatId>/<uuid>.<ext>) and the bucket.
// The Content-Type must be on the kind's allowlist. The link can't limit
// the size, so attachBeatFile (src/actions/beats.ts) checks the file after
// the upload, before its key is saved.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { signUploadUrl } from "@/lib/storage";
import {
  FILE_KINDS,
  extensionFor,
  fileRules,
  newUploadKey,
} from "@/lib/uploads";

const uploadRequestSchema = z.object({
  beatId: z.uuid(),
  kind: z.enum(FILE_KINDS),
  contentType: z.string().max(100),
});

export async function POST(request: Request) {
  await requireAdmin();

  const input = uploadRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!input.success) {
    return Response.json({ error: "Unknown upload." }, { status: 400 });
  }
  const { beatId, kind, contentType } = input.data;

  const extension = extensionFor(kind, contentType);
  if (!extension) {
    const extensions = [...new Set(Object.values(fileRules[kind].types))];
    return Response.json(
      {
        error: `A ${fileRules[kind].label} must be a ${extensions.join(", ")} file.`,
      },
      { status: 400 },
    );
  }

  const beat = await db.beat.findUnique({
    where: { id: beatId },
    select: { id: true },
  });
  if (!beat) {
    return Response.json(
      { error: "This beat no longer exists." },
      { status: 404 },
    );
  }

  const key = newUploadKey(beatId, extension);
  const url = await signUploadUrl(fileRules[kind].bucket, key, contentType);
  return Response.json({ url, key });
}
