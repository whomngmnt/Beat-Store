import Link from "next/link";
import { AudioLines, User } from "lucide-react";
import { CartButton } from "@/components/cart/CartButton";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <AudioLines className="size-5" aria-hidden />
          Beat Store
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          <Link href="/beats" className={buttonVariants({ variant: "ghost" })}>
            Beats
          </Link>
          <Link
            href="/licenses"
            className={buttonVariants({ variant: "ghost" })}
          >
            Licenses
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <CartButton />
          <CartDrawer />
          <Link
            href="/account"
            aria-label="Account"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <User aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
