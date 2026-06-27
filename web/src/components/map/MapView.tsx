"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

// Google Maps is loaded at runtime; we use the global namespace untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

type StableMarker = {
  slug: string;
  name: string;
  city: string;
  rating: number | null;
  reviewCount: number;
  image: string | null;
  featured: boolean;
  verified: boolean;
  offering: string;
  priceFrom: number | null;
  amenities: string[];
  lng: number;
  lat: number;
};

const DEFAULT_CENTER = { lat: 26.12, lng: -80.25 }; // Broward / South FL
const DEFAULT_ZOOM = 9;
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="text-xs text-ink/45">No rating yet</span>;
  return (
    <span className="text-xs text-ink/60">
      <span className="text-brass">★</span> {rating.toFixed(1)}
      {count > 0 && <span className="text-ink/45"> ({count})</span>}
    </span>
  );
}

function StableCard({
  s,
  selected,
  onHover,
  innerRef,
}: {
  s: StableMarker;
  selected: boolean;
  onHover: () => void;
  innerRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={innerRef}
      onMouseEnter={onHover}
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        selected ? "border-brass ring-2 ring-brass" : "border-leather/15 hover:border-brass/50"
      }`}
    >
      <Link href={`/business/${s.slug}`} className="block">
        <div className="relative aspect-[16/10] w-full bg-cream-dark">
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image} alt={s.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-leather/30">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden>
                <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
              </svg>
            </div>
          )}
          {/* Offering header on the listing (default "Stalls Available") */}
          <span className="absolute left-2 top-2 rounded-full bg-pine/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {s.offering}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
            {s.priceFrom != null && (
              <p className="shrink-0 text-sm font-semibold text-ink">
                ${s.priceFrom.toLocaleString()}
                <span className="text-xs font-normal text-ink/50">/mo</span>
              </p>
            )}
          </div>
          <p className="truncate text-xs text-ink/55">{s.city}</p>
          <div className="mt-1">
            <Stars rating={s.rating} count={s.reviewCount} />
          </div>
          {s.amenities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {s.amenities.slice(0, 4).map((a) => (
                <span key={a} className="rounded-full bg-pine/5 px-2 py-0.5 text-[11px] text-pine">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustererRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersBySlugRef = useRef<Record<string, any>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefsMobile = useRef<Record<string, HTMLDivElement | null>>({});

  const [items, setItems] = useState<StableMarker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (s) =>
        (!q || `${s.name} ${s.city}`.toLowerCase().includes(q)) &&
        (minRating == null || (s.rating ?? 0) >= minRating) &&
        (!verifiedOnly || s.verified),
    );
  }, [items, query, minRating, verifiedOnly]);

  const activeFilters = (minRating != null ? 1 : 0) + (verifiedOnly ? 1 : 0);

  function markerIcon(active: boolean) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: active ? 11 : 7,
      fillColor: active ? "#1d4ed8" : "#3b82f6",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: active ? 3 : 2,
    };
  }

  // Select a stable: highlight it on the map, pan to it, and scroll its card
  // into view (works from both a marker tap and a list/card tap).
  const selectStable = (slug: string) => {
    setSelected(slug);
    const s = items.find((x) => x.slug === slug);
    if (s) mapRef.current?.panTo({ lat: s.lat, lng: s.lng });
    // Scroll whichever list is visible (desktop panel / mobile carousel).
    cardRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    cardRefsMobile.current[slug]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  // Load data (independent of the map, so the list works even without a key).
  useEffect(() => {
    fetch("/api/map")
      .then((r) => r.json())
      .then((g) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: StableMarker[] = (g.features ?? []).map((f: any) => ({
          ...f.properties,
          rating: f.properties.rating ?? null,
          offering: f.properties.offering ?? "Stalls Available",
          priceFrom: f.properties.priceFrom ?? null,
          amenities: f.properties.amenities ?? [],
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
        setItems(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Init Google Maps.
  useEffect(() => {
    if (!MAPS_KEY || !containerRef.current) return;
    let cancelled = false;
    setOptions({ key: MAPS_KEY, v: "weekly" });
    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setMapReady(true);
      })
      .catch((err) => {
        console.error("[gmaps]", err);
        setLoadError(String(err?.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // (Re)render markers when data/filters change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.setMap(null));
    const bySlug: Record<string, unknown> = {};
    const markers = filtered.map((s) => {
      const m = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        icon: markerIcon(false),
        title: s.name,
      });
      m.addListener("click", () => selectStable(s.slug));
      bySlug[s.slug] = m;
      return m;
    });
    markersRef.current = markers;
    markersBySlugRef.current = bySlug;

    if (!clustererRef.current) {
      // Brand-blue cluster bubbles (default renderer is red/yellow — off-brand).
      const renderer = {
        render: ({ count, position }: { count: number; position: unknown }) => {
          const size = count < 10 ? 38 : count < 50 ? 46 : 54;
          const svg = btoa(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
              `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#3b82f6" fill-opacity="0.95" stroke="#ffffff" stroke-width="2"/></svg>`,
          );
          return new google.maps.Marker({
            position,
            icon: {
              url: `data:image/svg+xml;base64,${svg}`,
              scaledSize: new google.maps.Size(size, size),
              anchor: new google.maps.Point(size / 2, size / 2),
            },
            label: { text: String(count), color: "#ffffff", fontSize: "12px", fontWeight: "700" },
            zIndex: 1000 + count,
          });
        },
      };
      clustererRef.current = new MarkerClusterer({ map, renderer });
    }
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(markers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, mapReady]);

  // Emphasize the selected stable's marker without rebuilding the cluster.
  useEffect(() => {
    if (!mapReady) return;
    Object.entries(markersBySlugRef.current).forEach(([slug, m]) => {
      const marker = m as { setIcon: (i: unknown) => void; setZIndex: (z: number) => void };
      const active = slug === selected;
      marker.setIcon(markerIcon(active));
      marker.setZIndex(active ? 999 : 1);
    });
  }, [selected, mapReady, filtered]);

  const nearMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      mapRef.current?.setZoom(11);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream">
      {/* TOP BAR: home + search + filter (full width) */}
      <div className="z-30 flex flex-col gap-2 border-b border-leather/15 bg-white/95 p-2 backdrop-blur">
        <div className="flex gap-2">
          <Link
            href="/"
            aria-label="Home"
            className="flex shrink-0 items-center rounded-full border border-leather/15 bg-white px-3 text-ink shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-brass" fill="currentColor" aria-hidden>
              <path d="M5 3c1 3 2 4 4 4 1.5 0 2-1 4-1 3 0 5 3 5 7 0 4-2 8-6 8-1.5 0-2.5-1-2.5-2.5 0-2 2-2.5 2-4.5 0-1-1-2-2.5-2S8 11 8 13c0 3 2 4 2 6 0 1-1 2-2.5 2C4 21 3 16 3 11c0-4 1-6 2-8z" />
            </svg>
          </Link>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search stables by name or city…"
            aria-label="Search stables"
            className="w-full rounded-full border border-leather/15 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brass"
          />
          <button
            onClick={() => setShowFilters(true)}
            aria-label="Filters"
            className="relative shrink-0 rounded-full border border-leather/15 bg-white px-3 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
            {activeFilters > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
        {/* Active filter chips (dismissible) */}
        {activeFilters > 0 && (
          <div className={`flex gap-2 overflow-x-auto ${NO_SCROLLBAR}`}>
            {minRating != null && (
              <button
                onClick={() => setMinRating(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                {minRating}★ &amp; up <span aria-hidden>✕</span>
              </button>
            )}
            {verifiedOnly && (
              <button
                onClick={() => setVerifiedOnly(false)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                Verified <span aria-hidden>✕</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* BODY: list left (desktop) + map right */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* LEFT: results list (desktop only) */}
        <aside className="hidden w-[420px] shrink-0 flex-col overflow-hidden border-r border-leather/15 lg:flex">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-ink">
              {loading ? "Loading…" : `${filtered.length} stable${filtered.length === 1 ? "" : "s"}`}
            </span>
            <span className="text-xs text-ink/45">Boarding facilities</span>
          </div>
          <div className="grid flex-1 grid-cols-1 content-start gap-3 overflow-y-auto p-3 pt-0">
            {!loading && filtered.length === 0 && (
              <p className="rounded-xl border border-dashed border-leather/30 bg-white p-6 text-center text-sm text-ink/55">
                No stables match these filters.
              </p>
            )}
            {filtered.map((s) => (
              <StableCard
                key={s.slug}
                s={s}
                selected={selected === s.slug}
                onHover={() => setSelected(s.slug)}
                innerRef={(el) => {
                  cardRefs.current[s.slug] = el;
                }}
              />
            ))}
          </div>
        </aside>

        {/* RIGHT: map */}
        <div className="relative flex-1">
          <div ref={containerRef} className="absolute inset-0" />

          {/* No-key / error fallback */}
          {(!MAPS_KEY || loadError) && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="max-w-xs text-sm text-ink/60">
                {loadError
                  ? "Map couldn’t load — browse the list instead."
                  : "Map key not set yet — browse the list instead."}
              </p>
            </div>
          )}

          {/* Near-me */}
          {MAPS_KEY && (
            <button
              onClick={nearMe}
              aria-label="Near me"
              className="absolute bottom-44 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow lg:bottom-4"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {/* MOBILE bottom carousel (desktop uses the left list) */}
          {view === "map" && (
            <div className="absolute inset-x-0 bottom-0 z-20 pb-2 lg:hidden">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-medium text-ink shadow">
                  {loading ? "Loading…" : `${filtered.length} stable${filtered.length === 1 ? "" : "s"}`}
                </span>
                <button
                  onClick={() => setView("list")}
                  className="rounded-full bg-white/95 px-3 py-1 text-sm font-medium text-ink shadow"
                >
                  List ▤
                </button>
              </div>
              <div className={`flex gap-3 overflow-x-auto px-3 pb-1 ${NO_SCROLLBAR}`}>
                {!loading && filtered.length === 0 && (
                  <div className="w-full rounded-xl bg-white p-4 text-center text-sm text-ink/55 shadow">
                    No stables match these filters.
                  </div>
                )}
                {filtered.slice(0, 60).map((s) => (
                  <div
                    key={s.slug}
                    ref={(el) => {
                      cardRefsMobile.current[s.slug] = el;
                    }}
                    className="w-64 shrink-0"
                  >
                    <StableCard
                      s={s}
                      selected={selected === s.slug}
                      onHover={() => setSelected(s.slug)}
                      innerRef={() => {}}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MOBILE full-screen list */}
          {view === "list" && (
            <div className="absolute inset-0 z-30 overflow-y-auto bg-cream p-3 lg:hidden">
              <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center justify-between bg-cream/95 px-3 py-2 backdrop-blur">
                <span className="text-sm font-medium text-ink">
                  {filtered.length} stable{filtered.length === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => setView("map")}
                  className="rounded-full bg-pine px-3 py-1 text-sm font-medium text-cream shadow"
                >
                  Map ◎
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((s) => (
                  <StableCard
                    key={s.slug}
                    s={s}
                    selected={selected === s.slug}
                    onHover={() => setSelected(s.slug)}
                    innerRef={() => {}}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter sheet */}
      {showFilters && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/30" onClick={() => setShowFilters(false)}>
          <div className="w-full rounded-t-2xl bg-cream p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Filters</h2>
              <button
                onClick={() => {
                  setMinRating(null);
                  setVerifiedOnly(false);
                }}
                className="text-sm font-medium text-brass"
              >
                Reset
              </button>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Rating</p>
            <div className="mt-2 flex gap-2">
              {[4, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRating(minRating === r ? null : r)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    minRating === r ? "bg-pine text-cream" : "bg-white text-ink ring-1 ring-leather/15"
                  }`}
                >
                  {r}★ &amp; up
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/55">Trust</p>
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                verifiedOnly ? "bg-pine text-cream" : "bg-white text-ink ring-1 ring-leather/15"
              }`}
            >
              <span className={`h-3.5 w-3.5 rounded ${verifiedOnly ? "bg-brass" : "border border-leather/30"}`} />
              Verified only
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="mt-5 w-full rounded-lg bg-pine py-3 font-semibold text-cream transition hover:bg-pine-light"
            >
              See {filtered.length} stable{filtered.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
