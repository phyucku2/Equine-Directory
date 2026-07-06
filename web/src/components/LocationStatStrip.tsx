import { getLocationStats } from "@/lib/db/stats";

// Per-hub real-data stat strip (Lever 1B). Gives each programmatic city/county
// page unique, useful numbers — facility count, average rating, starting price,
// live openings — so it reads as a genuine local resource, not a thin template.
// Server component; renders nothing when the area has no priced/rated data to
// avoid empty tiles.
export async function LocationStatStrip({ locationId, place }: { locationId: string; place: string }) {
  let s;
  try {
    s = await getLocationStats(locationId);
  } catch {
    return null;
  }
  if (s.facilities === 0) return null;

  const tiles: { n: string; l: string }[] = [
    { n: s.facilities.toLocaleString(), l: place ? `Facilities in ${place}` : "Facilities" },
  ];
  if (s.avgRating != null) tiles.push({ n: `★ ${s.avgRating.toFixed(1)}`, l: "Average rating" });
  if (s.priceFrom != null) tiles.push({ n: `$${s.priceFrom.toLocaleString()}`, l: "Board from / mo" });
  if (s.spotsAvailable > 0) tiles.push({ n: s.spotsAvailable.toLocaleString(), l: "Open spots" });
  else if (s.reviews > 0) tiles.push({ n: s.reviews.toLocaleString(), l: "Owner reviews" });

  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.l} className="rounded-xl border border-leather/15 bg-white p-3 text-center">
          <dt className="sr-only">{t.l}</dt>
          <dd className="text-lg font-bold text-pine">{t.n}</dd>
          <p className="mt-0.5 text-[11px] text-ink/55">{t.l}</p>
        </div>
      ))}
    </dl>
  );
}
