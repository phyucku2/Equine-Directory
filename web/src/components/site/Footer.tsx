import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-stone-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-bold text-emerald-800">{SITE.name}</p>
          <p className="mt-2 text-sm text-stone-500">
            The trusted directory of equine businesses & services. Florida-first, expanding
            nationwide.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-stone-700">Explore</p>
          <ul className="mt-2 space-y-1 text-stone-500">
            <li><Link href="/categories" className="hover:text-emerald-700">All categories</Link></li>
            <li><Link href="/locations/florida" className="hover:text-emerald-700">Browse Florida</Link></li>
            <li><Link href="/search" className="hover:text-emerald-700">Search listings</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-stone-700">For businesses</p>
          <ul className="mt-2 space-y-1 text-stone-500">
            <li><Link href="/claim" className="hover:text-emerald-700">Claim your listing</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
