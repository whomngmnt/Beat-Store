import type { Metadata } from "next";
import Link from "next/link";
import { BeatStatusBadge } from "@/components/admin/AdminLabels";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Beats" };

// Every beat, newest first, with its status and which files it has
// (PLAN.md §3). The catalog has about a dozen beats, so there's no paging.
export default async function AdminBeatsPage() {
  await requireAdmin();

  const beats = await db.beat.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      bpm: true,
      plays: true,
      coverKey: true,
      previewKey: true,
      mp3Key: true,
      wavKey: true,
      stemsKey: true,
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Beats</h1>
          <p className="text-muted-foreground">{beats.length} beats</p>
        </div>
        <Link href="/admin/beats/new" className={buttonVariants()}>
          New beat
        </Link>
      </div>

      {beats.length === 0 ? (
        <p className="text-muted-foreground">
          No beats yet. Add one with New beat.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Files</th>
                <th className="px-3 py-2 text-right font-medium">BPM</th>
                <th className="px-3 py-2 text-right font-medium">Plays</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {beats.map((beat) => {
                const files = [
                  ["Cover", beat.coverKey],
                  ["Preview", beat.previewKey],
                  ["MP3", beat.mp3Key],
                  ["WAV", beat.wavKey],
                  ["Stems", beat.stemsKey],
                ] as const;
                return (
                  <tr key={beat.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/beats/${beat.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {beat.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <BeatStatusBadge status={beat.status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {files
                        .filter(([, key]) => key)
                        .map(([name]) => name)
                        .join(", ") || "None"}
                    </td>
                    <td className="px-3 py-2 text-right">{beat.bpm}</td>
                    <td className="px-3 py-2 text-right">{beat.plays}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
