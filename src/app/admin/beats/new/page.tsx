import type { Metadata } from "next";
import Link from "next/link";
import { BeatDetailsForm } from "@/components/admin/BeatForms";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "New beat" };

// Step 1 of adding a beat: its details. It's saved as a DRAFT, and the edit
// page that opens next takes the files, prices and publishing.
export default async function NewBeatPage() {
  await requireAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/beats" className="text-sm text-muted-foreground">
          ← Beats
        </Link>
        <h1 className="text-3xl font-semibold">New beat</h1>
        <p className="text-muted-foreground">
          Saved as a draft. Upload its files on the next page.
        </p>
      </div>
      <BeatDetailsForm />
    </div>
  );
}
