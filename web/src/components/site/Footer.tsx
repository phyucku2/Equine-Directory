import Link from "next/link";
import { SITE } from "@/lib/site";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-leather/15 bg-cream-dark">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-semibold tracking-tight text-pine">{SITE.name}</p>
          <p className="mt-2 text-sm text-ink/55">
            The equine services directory — stables, trainers, vets, farriers, tack &amp; feed,
            nationwide.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-pine">Explore</p>
          <ul className="mt-2 space-y-1 text-ink/55">
            <li><Link href="/map" className="hover:text-brass">Map</Link></li>
            <li><Link href="/categories" className="hover:text-brass">Browse services</Link></li>
            <li><Link href="/events" className="hover:text-brass">Events &amp; camps</Link></li>
            <li><Link href="/guides" className="hover:text-brass">Owner guides</Link></li>
            <li><Link href="/data" className="hover:text-brass">Industry data</Link></li>
            <li><Link href="/search" className="hover:text-brass">Search</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-pine">For businesses</p>
          <ul className="mt-2 space-y-1 text-ink/55">
            <li><Link href="/claim" className="hover:text-brass">List your business</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-pine">Stay in the loop</p>
          <p className="mt-2 text-xs text-ink/50">
            New listings, camp season openings, and owner guides — no spam.
          </p>
          <NewsletterSignup source="footer" />
        </div>
      </div>
      <div className="border-t border-leather/15 py-4 text-center text-xs text-ink/40">
        © {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
