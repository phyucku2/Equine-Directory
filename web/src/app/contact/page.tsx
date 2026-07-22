import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

// Static Contact page — gives the site a clear, reachable point of contact
// (required signal for AdSense approval, and generally useful).
export const metadata: Metadata = {
  title: `Contact ${SITE.name}`,
  description: `Get in touch with ${SITE.name} — questions, listing corrections, and business inquiries.`,
  alternates: { canonical: "/contact" },
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "stablesnearme@gmail.com";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-pine">Contact us</h1>

      <div className="mt-8 space-y-6 text-ink/80 [&_a]:text-brass [&_a]:underline [&_p]:leading-relaxed">
        <p>
          Questions, feedback, or a correction to a listing? We&rsquo;d love to hear from you. Email
          us and we&rsquo;ll get back to you as soon as we can.
        </p>

        <p className="text-lg">
          <strong className="text-pine">Email:</strong>{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

        <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-5">
          <p className="font-semibold text-pine">Own an equine business?</p>
          <p className="mt-1 text-sm">
            You can <Link href="/claim">claim your listing</Link> for free to update your details
            and receive inquiries from horse owners.
          </p>
        </div>

        <div className="rounded-xl border border-leather/15 bg-cream-dark/40 p-5">
          <p className="font-semibold text-pine">Need a correction?</p>
          <p className="mt-1 text-sm">
            If a listing has wrong or outdated information, email us the business name and what
            should change, and we&rsquo;ll take care of it.
          </p>
        </div>
      </div>

      <div className="mt-12 border-t border-leather/15 pt-6 text-sm">
        <Link href="/" className="text-brass hover:underline">
          ← Back to {SITE.name}
        </Link>
      </div>
    </div>
  );
}
