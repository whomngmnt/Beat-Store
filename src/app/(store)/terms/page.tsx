import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Beat Store and buying licenses.",
};

const linkClass = "underline underline-offset-4";

// A short plain-English summary, not reviewed legal text. It has to be
// rewritten before the store ever takes real payments (live mode is v2).
export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-3xl font-semibold">Terms</h1>

      <Section title="Test mode">
        Payments run in Stripe&apos;s test mode. No real money is charged and no
        real license is sold. Every order placed here is a test.
      </Section>

      <Section title="Licenses">
        Every beat is sold under one of the licenses on the{" "}
        <Link href="/licenses" className={linkClass}>
          Licenses
        </Link>{" "}
        page. The license you pick sets which files you get and how you may use
        the beat. Leases are non-exclusive, so other artists can lease the same
        beat. An Exclusive transfers ownership of the beat to you and removes it
        from the store.
      </Section>

      <Section title="Previews">
        The previews on this site carry an audio tag and are for listening only.
        Don&apos;t use them in a release.
      </Section>

      <Section title="Downloads">
        After paying, you get a download link for each file. Each file can be
        downloaded 5 times, and the link on your order page works for 30 days.
        Keep that link private: anyone who has it can download your files.
      </Section>

      <Section title="Accounts">
        You don&apos;t need an account to buy. If you sign in, it&apos;s with
        Google, and your account shows your orders.
      </Section>

      <Section title="Changes and questions">
        These terms may change. Questions go through the{" "}
        <Link href="/contact" className={linkClass}>
          contact
        </Link>{" "}
        page.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </section>
  );
}
