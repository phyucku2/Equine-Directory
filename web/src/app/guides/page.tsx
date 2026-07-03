import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { absoluteUrl } from "@/lib/urls";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Horse Owner Guides",
  description:
    "Practical guides for horse owners — choosing a boarding barn, understanding boarding costs, finding summer camps, and more.",
  alternates: { canonical: absoluteUrl("/guides") },
};

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Guides", url: "/guides" }]} />
      <h1 className="mt-4 text-3xl font-bold text-pine">Horse owner guides</h1>
      <p className="mt-1 text-ink/55">
        Practical, no-nonsense answers to the questions every horse owner asks.
      </p>
      <div className="mt-8 space-y-4">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="block rounded-2xl border border-leather/15 bg-white p-5 transition hover:border-brass hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-pine">{g.title}</h2>
            <p className="mt-1 text-sm text-ink/55">{g.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
