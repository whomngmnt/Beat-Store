import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Beat Store stores about you, and why.",
};

// Lists only what the code really stores (prisma/schema.prisma: User,
// Session, Order, Download; the cart in localStorage). Update it when a
// later slice adds something, like the receipt email.
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <h1 className="text-3xl font-semibold">Privacy</h1>

      <Section title="When you buy">
        <li>The email you type on Stripe&apos;s checkout page.</li>
        <li>The beats and licenses you bought, and what you paid.</li>
        <li>How many times each file has been downloaded.</li>
        <li>
          Your card details go straight to Stripe. This site never sees or
          stores them.
        </li>
      </Section>

      <Section title="When you sign in">
        <li>Your name, email address and profile picture, from Google.</li>
        <li>
          A cookie that keeps you signed in. With each sign-in, your IP address
          and browser details are saved too.
        </li>
      </Section>

      <Section title="In your browser">
        <li>Your cart is saved in your browser, so it survives a reload.</li>
        <li>
          Cookies are used only for signing in. There are no ads or trackers.
        </li>
      </Section>

      <Section title="Services that handle this data">
        <li>Stripe: payments</li>
        <li>Google: sign-in</li>
        <li>Vercel: hosting</li>
        <li>Neon: the database</li>
        <li>Cloudflare R2: file storage</li>
      </Section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your data</h2>
        <p className="text-muted-foreground">
          This data is used only to deliver your files and show your orders. To
          see, change or delete it, get in touch through the{" "}
          <Link href="/contact" className="underline underline-offset-4">
            contact
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {children}
      </ul>
    </section>
  );
}
