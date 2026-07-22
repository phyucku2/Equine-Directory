import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

// Static About page. Content-rich, indexable, and — alongside Contact + Privacy
// — signals to reviewers (AdSense) that this is a real, operated business.
export const metadata: Metadata = {
  title: `About ${SITE.name}`,
  description: `${SITE.name} is a nationwide directory of horse boarding, training, and equine services — helping horse owners find the right barn and helping equine businesses get found.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-pine">About {SITE.name}</h1>

      <div className="mt-8 space-y-6 text-ink/80 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-pine [&_a]:text-brass [&_a]:underline [&_p]:leading-relaxed">
        <p>
          {SITE.name} is a nationwide directory of equine businesses — horse boarding stables,
          trainers, riding lessons, veterinarians, farriers, tack shops, and feed stores. Our goal
          is simple: make it easy to find the right barn or equine service near you, and easy for
          those businesses to be found.
        </p>

        <h2>For horse owners</h2>
        <p>
          Whether you&rsquo;re looking for a boarding barn with an open stall, a trainer in your
          discipline, or a farrier who covers your area, {SITE.name} brings equine businesses across
          the country into one searchable place. Browse by{" "}
          <Link href="/map">map</Link>, search by{" "}
          <Link href="/search">location and service</Link>, and read owner{" "}
          <Link href="/guides">guides</Link> to help you choose.
        </p>

        <h2>For equine businesses</h2>
        <p>
          If you run a stable or equine service, your listing may already be here. You can{" "}
          <Link href="/claim">claim your listing</Link> for free to keep your details accurate,
          respond to inquiries from horse owners, and reach people searching in your area.
        </p>

        <h2>How our listings are built</h2>
        <p>
          Listings are compiled from publicly available information and continually updated. We work
          to keep data accurate, and business owners can claim and correct their own listings at any
          time. If something looks wrong, please <Link href="/contact">let us know</Link>.
        </p>

        <h2>Our data</h2>
        <p>
          We also publish aggregate <Link href="/data">industry data</Link> on equine services
          across the country — a free resource for owners, journalists, and researchers.
        </p>
      </div>

      <div className="mt-12 border-t border-leather/15 pt-6 text-sm">
        <Link href="/" className="text-brass hover:underline">
          ← Back to {SITE.name}
        </Link>
      </div>
    </div>
  );
}
