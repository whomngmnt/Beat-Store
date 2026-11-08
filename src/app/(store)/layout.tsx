import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
