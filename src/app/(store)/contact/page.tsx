import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to get in touch.",
};

// The email and social links come from env vars, so no real address or
// handle is in the code. Any that isn't set is left out.
export default function ContactPage() {
  const email = process.env.CONTACT_EMAIL;
  const socials = [
    { label: "Instagram", href: process.env.INSTAGRAM_URL },
    { label: "TikTok", href: process.env.TIKTOK_URL },
    { label: "YouTube", href: process.env.YOUTUBE_URL },
  ].filter((social) => social.href);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Contact</h1>
        <p className="text-muted-foreground">
          Questions about a license, a problem with an order, or anything else:
          get in touch. For an order, say which beat and license you bought.
        </p>
      </div>

      {email && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Email</h2>
          <a href={`mailto:${email}`} className="underline underline-offset-4">
            {email}
          </a>
        </section>
      )}

      {socials.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Social</h2>
          <ul className="flex flex-col gap-1">
            {socials.map((social) => (
              <li key={social.label}>
                <a href={social.href} className="underline underline-offset-4">
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!email && socials.length === 0 && (
        <p className="text-muted-foreground">
          Contact details aren&apos;t set up yet.
        </p>
      )}
    </div>
  );
}
