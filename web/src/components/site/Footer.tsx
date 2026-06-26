import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-leather/15 bg-cream-dark">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-serif text-lg font-semibold text-pine">{SITE.name}</p>
          <p className="mt-2 text-sm text-ink/55">
            The directory of horse barns. Florida-first, expanding nationwide.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-pine">Explore</p>
          <ul className="mt-2 space-y-1 text-ink/55">
            <li><Link href="/locations/florida" className="hover:text-brass">Browse Florida</Link></li>
            <li><Link href="/search" className="hover:text-brass">Search barns</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-pine">For barn owners</p>
          <ul className="mt-2 space-y-1 text-ink/55">
            <li><Link href="/claim" className="hover:text-brass">List your barn</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-leather/15 py-4 text-center text-xs text-ink/40">
        © {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
