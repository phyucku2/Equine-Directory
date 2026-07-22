import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

// Static privacy policy. Required before serving Google AdSense (third-party ad
// cookies must be disclosed) and for the GA4 analytics already running. Kept as
// a plain server component so it's statically generated and indexable.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, and protects your information, including cookies, analytics, and advertising.`,
  alternates: { canonical: "/privacy" },
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "stablesnearme@gmail.com";
const UPDATED = "July 18, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-pine">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink/50">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8 text-ink/80 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-pine [&_a]:text-brass [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_p]:leading-relaxed">
        <section className="space-y-3">
          <p>
            {SITE.name} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates {SITE.domain}, a directory of
            equine businesses and services. This policy explains what information we collect, how we
            use it, and the choices you have.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Information you provide:</strong> your name, email, phone, and message when you
              submit an inquiry, claim a listing, create an account, or subscribe to updates.
            </li>
            <li>
              <strong>Business listing data:</strong> publicly available information about equine
              businesses (name, address, phone, website) compiled from public sources.
            </li>
            <li>
              <strong>Usage data:</strong> pages viewed, approximate location, device and browser
              type, and similar analytics, collected automatically via cookies and similar
              technologies.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2>Cookies and analytics</h2>
          <p>
            We use cookies and similar technologies to operate the site and understand how it is
            used. We use <strong>Google Analytics</strong> to measure traffic and improve the
            service; Google Analytics sets cookies and processes usage data on our behalf. You can
            opt out of Google Analytics with the{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2>Advertising</h2>
          <p>
            We may display ads served by <strong>Google AdSense</strong>. Third-party vendors,
            including Google, use cookies to serve ads based on your prior visits to this and other
            websites.
          </p>
          <ul>
            <li>
              Google&rsquo;s use of advertising cookies enables it and its partners to serve ads
              based on your visits to our site and/or other sites on the Internet.
            </li>
            <li>
              You may opt out of personalized advertising by visiting{" "}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">
                Google Ads Settings
              </a>
              , or opt out of a third-party vendor&rsquo;s use of cookies for personalized
              advertising at{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer">
                aboutads.info/choices
              </a>
              .
            </li>
          </ul>
          <p>
            For more information about how Google uses data when you use our site, see{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">
              Google&rsquo;s partner-sites policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2>How we use information</h2>
          <ul>
            <li>To operate the directory and connect horse owners with equine businesses.</li>
            <li>To deliver inquiries to the relevant business and notify listing owners.</li>
            <li>To send updates you have requested, and service-related messages.</li>
            <li>To measure, secure, and improve the service.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2>How we share information</h2>
          <p>
            When you submit an inquiry to a business, we share the details of that inquiry with the
            business (or hold it until the business claims its listing). We use service providers
            (such as hosting, email delivery, analytics, and advertising) that process data on our
            behalf. We do not sell your personal information. We may disclose information if required
            by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Your choices and rights</h2>
          <p>
            You can unsubscribe from marketing email using the link in any such message. Depending on
            where you live, you may have rights to access, correct, or delete your personal
            information, or to opt out of certain processing (including &ldquo;sale&rdquo; or
            &ldquo;sharing&rdquo; as defined under laws like the CCPA). To exercise these rights,
            contact us at the address below.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Data retention &amp; security</h2>
          <p>
            We retain information for as long as needed to provide the service and for legitimate
            business or legal purposes, and we use reasonable safeguards to protect it. No method of
            transmission or storage is completely secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Children</h2>
          <p>
            The service is not directed to children under 13, and we do not knowingly collect
            personal information from them.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Changes</h2>
          <p>
            We may update this policy from time to time. Material changes will be reflected by the
            &ldquo;Last updated&rdquo; date above.
          </p>
        </section>

        <section className="space-y-3">
          <h2>Contact</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-leather/15 pt-6 text-sm">
        <Link href="/" className="text-brass hover:underline">
          ← Back to {SITE.name}
        </Link>
      </div>
    </div>
  );
}
