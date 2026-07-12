import Link from "next/link";
import type { Metadata } from "next";
import {
  getNationalStats,
  getStateCounts,
  getCategoryCounts,
  getBoardingPriceByState,
} from "@/lib/db/stats";
import { stateUrl, categoryUrl, absoluteUrl } from "@/lib/urls";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { datasetLd } from "@/lib/seo/jsonld";
import { CiteBox } from "@/components/data/CiteBox";
import { SITE } from "@/lib/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "US Equine Industry Data — Facilities, Boarding Costs & Rankings by State",
  description:
    "Free data on the US equine industry: horse boarding facilities by state, boarding costs, and equine-service counts — compiled from the nation's largest directory of stables and equine businesses.",
  alternates: { canonical: absoluteUrl("/data") },
  openGraph: { title: "US Equine Industry Data by State", type: "article" },
};

const NUM = new Intl.NumberFormat("en-US");
function money(n: number) {
  return `$${NUM.format(n)}`;
}

// Dependency-free horizontal bar — accessible (value in text), theme-tokened.
function Bar({ value, max, label, right }: { value: number; max: number; label: string; right: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 text-sm text-ink/70 sm:w-40">{label}</div>
      <div className="h-4 flex-1 overflow-hidden rounded bg-pine/5">
        <div className="h-full rounded bg-brass/70" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 shrink-0 text-right text-sm font-medium text-ink">{right}</div>
    </div>
  );
}

export default async function DataPage() {
  // Resilient to a build-time DB blip (cold Neon): render zeros/empty and let ISR
  // (revalidate) repopulate at runtime rather than failing the whole build.
  let national: Awaited<ReturnType<typeof getNationalStats>> = {
    facilities: 0,
    states: 0,
    cities: 0,
    avgRating: null,
    reviews: 0,
  };
  let states: Awaited<ReturnType<typeof getStateCounts>> = [];
  let categories: Awaited<ReturnType<typeof getCategoryCounts>> = [];
  let prices: Awaited<ReturnType<typeof getBoardingPriceByState>> = [];
  try {
    [national, states, categories, prices] = await Promise.all([
      getNationalStats(),
      getStateCounts(),
      getCategoryCounts(),
      getBoardingPriceByState(),
    ]);
  } catch {
    /* DB unreachable at build — ISR fills the study with real numbers at runtime. */
  }

  const topStates = states.slice(0, 15);
  const maxState = topStates[0]?.facilities ?? 1;
  const maxCat = categories[0]?.facilities ?? 1;
  const maxPrice = prices[0]?.medianPrice ?? 1;
  const year = new Date().getFullYear();

  const citeSnippet = `Source: <a href="${absoluteUrl("/data")}">${SITE.name} — US Equine Industry Data (${year})</a>`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <JsonLd
        data={datasetLd({
          name: `US Equine Industry Data (${year})`,
          description:
            "Horse boarding facilities, boarding costs, and equine-service counts by US state, compiled from The Stable Directory.",
          url: "/data",
        })}
      />
      <Breadcrumbs items={[{ name: "Home", url: "/" }, { name: "Data", url: "/data" }]} />

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-pine">US Equine Industry Data</h1>
        <p className="mt-2 max-w-2xl text-ink/65">
          Free, current statistics on America&rsquo;s horse-boarding and equine-service industry —
          compiled from {NUM.format(national.facilities)} listed facilities across{" "}
          {national.states} states. Updated continuously; cite it freely (see below).
        </p>
      </header>

      {/* Headline numbers */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: NUM.format(national.facilities), l: "Equine facilities" },
          { n: String(national.states), l: "States covered" },
          { n: NUM.format(national.cities), l: "Cities & towns" },
          { n: national.avgRating ? national.avgRating.toFixed(2) : "—", l: "Avg. rating" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-leather/15 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-pine">{s.n}</p>
            <p className="mt-1 text-xs text-ink/55">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Facilities by state */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-pine">Equine facilities by state</h2>
        <p className="mt-1 text-sm text-ink/55">Top 15 states by number of listed equine businesses.</p>
        <div className="mt-4">
          {topStates.map((s) => (
            <Bar
              key={s.slug}
              label={s.name}
              value={s.facilities}
              max={maxState}
              right={NUM.format(s.facilities)}
            />
          ))}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brass">All states →</summary>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {states.map((s) => (
              <Link key={s.slug} href={stateUrl(s.slug)} className="flex justify-between hover:text-brass">
                <span className="text-ink/70">{s.name}</span>
                <span className="font-medium text-ink">{NUM.format(s.facilities)}</span>
              </Link>
            ))}
          </div>
        </details>
      </section>

      {/* By category */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-pine">Facilities by service type</h2>
        <div className="mt-4">
          {categories.map((c) => (
            <Bar
              key={c.slug}
              label={c.name}
              value={c.facilities}
              max={maxCat}
              right={NUM.format(c.facilities)}
            />
          ))}
        </div>
        <p className="mt-3 text-sm">
          {categories.map((c, i) => (
            <span key={c.slug}>
              {i > 0 && " · "}
              <Link href={categoryUrl(c.slug)} className="text-brass hover:underline">
                {c.name}
              </Link>
            </span>
          ))}
        </p>
      </section>

      {/* Boarding cost by state */}
      {prices.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-pine">Median horse-boarding cost by state</h2>
          <p className="mt-1 text-sm text-ink/55">
            Median advertised monthly board, states with 5+ priced facilities. Actual rates vary by
            board type and services.
          </p>
          <div className="mt-4">
            {prices.slice(0, 15).map((s) => (
              <Bar
                key={s.slug}
                label={s.name}
                value={s.medianPrice}
                max={maxPrice}
                right={`${money(s.medianPrice)}/mo`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Methodology + cite */}
      <section className="mt-12 rounded-2xl border border-leather/15 bg-cream-dark p-5">
        <h2 className="text-lg font-semibold text-pine">Methodology &amp; citation</h2>
        <p className="mt-2 text-sm text-ink/65">
          Figures are compiled from {SITE.name}&rsquo;s directory of published, verified-category
          equine businesses across the United States, updated continuously as new facilities are
          added. Price figures reflect advertised starting monthly board where published and are
          medians per state. Journalists and researchers are welcome to cite these figures — please
          link back so readers can find the source.
        </p>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Cite this data</p>
          <div className="mt-2">
            <CiteBox snippet={citeSnippet} />
          </div>
        </div>
        <p className="mt-4 text-xs text-ink/45">
          Data as of {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
          For custom cuts or press inquiries, use the contact options on the site.
        </p>
      </section>
    </div>
  );
}
