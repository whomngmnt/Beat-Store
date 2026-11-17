"use client";

// One file of a beat (PLAN.md §5.5). Choosing a file:
// 1. asks /api/upload for a 10-minute upload link (the server picks the key),
// 2. PUTs the file straight to storage, never through the Next server,
// 3. asks attachBeatFile to check the file and save its key on the beat.
import { useState, type ChangeEvent } from "react";
import { attachBeatFile } from "@/actions/beats";

export function BeatFileUpload({
  beatId,
  kind,
  label,
  accept,
  children,
}: {
  beatId: string;
  kind: "cover" | "preview" | "mp3" | "wav" | "stems";
  label: string;
  accept: string;
  children?: React.ReactNode; // what's there now, from the server
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again works
    if (!file) return;

    setBusy(true);
    setMessage({ ok: true, text: `Uploading ${file.name}…` });
    try {
      const linkResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beatId, kind, contentType: file.type }),
      });
      const link = await linkResponse.json();
      if (!linkResponse.ok) throw new Error(link.error);

      // The Content-Type must be the one the link was signed for.
      const put = await fetch(link.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("The storage server refused the upload.");

      const result = await attachBeatFile(beatId, kind, link.key);
      setMessage({ ok: result.ok, text: result.message });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "The upload failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium capitalize">{label}</span>
        <label className="cursor-pointer text-sm underline-offset-4 hover:underline">
          {busy ? "Uploading…" : "Choose file"}
          <input
            type="file"
            accept={accept}
            onChange={upload}
            disabled={busy}
            className="sr-only"
          />
        </label>
      </div>
      {children}
      {message && (
        <p
          role="status"
          className={message.ok ? "text-sm" : "text-sm text-destructive"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
