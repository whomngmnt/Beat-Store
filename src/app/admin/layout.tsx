import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Beat Store" },
  robots: { index: false },
};

// The admin panel's frame (PLAN.md §3): its own nav, no store header or
// footer. requireAdmin() here keeps the nav from showing to anyone else,
// but a layout doesn't run again on every navigation, so each admin page
// and action also calls requireAdmin() itself. Those are the real checks.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3 text-sm">
          <Link href="/admin" className="font-semibold">
            Beat Store admin
          </Link>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/beats">Beats</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/licenses">Licenses</Link>
          <Link href="/admin/coupons">Coupons</Link>
          <Link href="/" className="ml-auto text-muted-foreground">
            Back to the store
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
