import Link from "next/link";
import { SITE } from "@/lib/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-leather/15 bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-pine">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-brass" fill="currentColor" aria-hidden>
            <path d="M5 3c1 3 2 4 4 4 1.5 0 2-1 4-1 3 0 5 3 5 7 0 4-2 8-6 8-1.5 0-2.5-1-2.5-2.5 0-2 2-2.5 2-4.5 0-1-1-2-2.5-2S8 11 8 13c0 3 2 4 2 6 0 1-1 2-2.5 2C4 21 3 16 3 11c0-4 1-6 2-8z" />
          </svg>
          <span className="font-serif text-xl font-semibold">{SITE.name}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-ink/70 sm:gap-4">
          <Link href="/map" className="hover:text-brass">
            Map
          </Link>
          <Link href="/locations/florida" className="hidden hover:text-brass sm:inline">
            Florida
          </Link>
          <Link href="/search" className="hover:text-brass">
            Search
          </Link>
          <Link
            href="/claim"
            className="rounded-lg bg-pine px-3 py-1.5 text-cream transition hover:bg-pine-light"
          >
            List your stable
          </Link>
        </nav>
      </div>
    </header>
  );
}
