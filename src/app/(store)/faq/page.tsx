import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about payments, licenses and downloads.",
};

const linkClass = "underline underline-offset-4";

// Plain text answers. The numbers match the code: 5 downloads per file
// (Download.maxCount), a 30-day guest link (src/lib/tokens.ts) and a
// Stripe session of about 30 minutes (PLAN.md §5.2).
export default function FaqPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-3xl font-semibold">FAQ</h1>

      <Question title="Can I really pay here?">
        Not yet. The store runs in Stripe&apos;s test mode, so no real money
        changes hands. To try a checkout, pay with the test card 4242 4242 4242
        4242, any future expiry date and any CVC.
      </Question>

      <Question title="Which license do I need?">
        It depends on how far your song will go. Each lease has a limit on
        streams and music videos. The Exclusive has no limits and takes the beat
        off the store. The{" "}
        <Link href="/licenses" className={linkClass}>
          Licenses
        </Link>{" "}
        page compares them.
      </Question>

      <Question title="Do I need an account to buy?">
        No. You can check out as a guest. Signing in only adds an order history
        and a way to download your files again.
      </Question>

      <Question title="How do I get my files?">
        Right after paying, you land on your order page with a download button
        for each file. Bookmark that page: it&apos;s your download link for 30
        days. Each file can be downloaded 5 times.
      </Question>

      <Question title="Can I download my files again later?">
        Yes. Sign in with Google using the email you paid with, and your orders
        show up on your{" "}
        <Link href="/account" className={linkClass}>
          account
        </Link>{" "}
        page.
      </Question>

      <Question title="What happens when I buy an exclusive?">
        While you&apos;re on the payment page, the beat is held for you for
        about 30 minutes, so nobody else can buy it. Once you&apos;ve paid, the
        beat is removed from the store.
      </Question>

      <Question title="I've used up my downloads, or something went wrong">
        Get in touch through the{" "}
        <Link href="/contact" className={linkClass}>
          contact
        </Link>{" "}
        page and say which order it is. Downloads can be reset and problems with
        an order are sorted out one by one.
      </Question>
    </div>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </section>
  );
}
