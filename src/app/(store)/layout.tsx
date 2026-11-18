import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Always on: v1 can only run in test mode (src/lib/stripe.ts
          refuses a live key). Shop pages only, not the admin panel. */}
      <p className="bg-amber-400 px-4 py-1.5 text-center text-sm font-medium text-black">
        TEST MODE — no real payments. Pay with the test card 4242 4242 4242
        4242.
      </p>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
