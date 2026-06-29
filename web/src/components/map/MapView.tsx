"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { StableCard, type StableMarker } from "@/components/stable/StableCard";
import { SaveSearchButton, type SaveSearchFilters } from "@/components/map/SaveSearchButton";
import { DISCIPLINES, BOARD_TYPES, TRAINING_TYPES, facetLabel } from "@/lib/facets";

const PRICE_OPTIONS = [
  { value: 500, label: "Under $500" },
  { value: 800, label: "Under $800" },
  { value: 1200, label: "Under $1,200" },
  { value: 2000, label: "Under $2,000" },
];

// Boolean facet flags: each tests a slug against a StableMarker array field.
const FLAG_FILTERS: { key: string; label: string; test: (s: StableMarker) => boolean }[] = [
  { key: "available", label: "Spots available", test: (s) => (s.spotsAvailable ?? 0) > 0 },
  { key: "cameras", label: "🎥 Cameras", test: (s) => s.securityFeatures?.includes("security-cameras") ?? false },
  { key: "indoor", label: "Indoor arena", test: (s) => s.amenities?.includes("indoor-arena") ?? false },
  { key: "camp", label: "Summer camp", test: (s) => s.programTypes?.includes("summer-camp") ?? false },
  { key: "openBarn", label: "Open barn", test: (s) => s.policies?.includes("open-barn") ?? false },
];

// Google Maps is loaded at runtime; we use the global namespace untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

const DEFAULT_CENTER = { lat: 26.12, lng: -80.25 }; // Broward / South FL
const DEFAULT_ZOOM = 9;
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

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
  // Zillow-style facet selections (multi-select slug sets + single price cap + flags).
  const [disciplines, setDisciplines] = useState<Set<string>>(new Set());
  const [boardTypes, setBoardTypes] = useState<Set<string>>(new Set());
  const [trainingTypes, setTrainingTypes] = useState<Set<string>>(new Set());
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"map" | "list">("map");
  // Lightweight saved-id merge (M5): render hearts filled where the signed-in
  // user has already favorited a listing. 401 (signed out) just yields no ids.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const hasSome = (have: string[] | undefined, want: Set<string>) =>
    want.size === 0 || (have ?? []).some((v) => want.has(v));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (s) =>
        (!q || `${s.name} ${s.city}`.toLowerCase().includes(q)) &&
        (minRating == null || (s.rating ?? 0) >= minRating) &&
        (!verifiedOnly || s.verified) &&
        hasSome(s.disciplines, disciplines) &&
        hasSome(s.boardTypes, boardTypes) &&
        hasSome(s.trainingTypes, trainingTypes) &&
        (priceMax == null || (s.priceFrom != null && s.priceFrom <= priceMax)) &&
        FLAG_FILTERS.every((f) => !flags.has(f.key) || f.test(s)),
    );
  }, [items, query, minRating, verifiedOnly, disciplines, boardTypes, trainingTypes, priceMax, flags]);

  const activeFilters =
    (minRating != null ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    disciplines.size +
    boardTypes.size +
    trainingTypes.size +
    (priceMax != null ? 1 : 0) +
    flags.size;

  // Toggle a slug in a Set-valued filter (immutably, so React re-renders).
  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    slug: string,
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const resetFacets = () => {
    setMinRating(null);
    setVerifiedOnly(false);
    setDisciplines(new Set());
    setBoardTypes(new Set());
    setTrainingTypes(new Set());
    setPriceMax(null);
    setFlags(new Set());
  };

  // Snapshot the current filters + map viewport for "Save this search" (M8a).
  // Mirrors the /api/saved-searches filter shape (which mirrors /api/map params).
  const currentFilters = (): SaveSearchFilters => {
    const f: SaveSearchFilters = { category: "horse-boarding" };
    const q = query.trim();
    if (q) f.q = q;
    if (minRating != null) f.rating = minRating;
    if (verifiedOnly) f.verified = true;
    if (disciplines.size) f.disciplines = [...disciplines];
    if (boardTypes.size) f.boardTypes = [...boardTypes];
    if (trainingTypes.size) f.trainingTypes = [...trainingTypes];
    if (priceMax != null) f.priceMax = priceMax;
    if (flags.has("cameras")) f.securityFeatures = ["security-cameras"];
    if (flags.has("indoor")) f.amenities = ["indoor-arena"];
    if (flags.has("openBarn")) f.policies = ["open-barn"];
    if (flags.has("camp")) f.programTypes = ["summer-camp"];
    if (flags.has("available")) f.available = true;
    const bounds = mapRef.current?.getBounds?.();
    if (bounds) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      f.bbox = [sw.lng(), sw.lat(), ne.lng(), ne.lat()];
    }
    return f;
  };

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

  // Merge in the user's saved business ids so hearts on the cards render filled.
  useEffect(() => {
    fetch("/api/saved-stables")
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: string[] }) => {
        if (Array.isArray(d.ids)) setSavedIds(new Set(d.ids));
      })
      .catch(() => {});
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

    // Fan out markers that share (near-)identical coordinates. Stacked listings
    // otherwise collapse into a cluster that shows "2" but can never separate by
    // zoom (same pixel at every zoom) and only ever surfaces one card. We spread
    // each colliding group around a tiny (~22m) circle so they're individually
    // visible and tappable once zoomed in.
    const groups = new Map<string, StableMarker[]>();
    for (const s of filtered) {
      const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
      const g = groups.get(key);
      if (g) g.push(s);
      else groups.set(key, [s]);
    }
    const posBySlug: Record<string, { lat: number; lng: number }> = {};
    for (const group of groups.values()) {
      if (group.length === 1) {
        posBySlug[group[0].slug] = { lat: group[0].lat, lng: group[0].lng };
        continue;
      }
      const R = 0.0002; // ~22m in latitude degrees
      group.forEach((s, i) => {
        const a = (2 * Math.PI * i) / group.length;
        posBySlug[s.slug] = {
          lat: s.lat + R * Math.sin(a),
          lng: s.lng + (R * Math.cos(a)) / Math.cos((s.lat * Math.PI) / 180),
        };
      });
    }

    const bySlug: Record<string, unknown> = {};
    const markers = filtered.map((s) => {
      const m = new google.maps.Marker({
        position: posBySlug[s.slug] ?? { lat: s.lat, lng: s.lng },
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
          <SaveSearchButton filters={currentFilters} />
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
            {[...disciplines].map((slug) => (
              <button
                key={`d-${slug}`}
                onClick={() => toggleIn(setDisciplines, slug)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                {facetLabel("disciplines", slug)} <span aria-hidden>✕</span>
              </button>
            ))}
            {[...boardTypes].map((slug) => (
              <button
                key={`b-${slug}`}
                onClick={() => toggleIn(setBoardTypes, slug)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                {facetLabel("boardTypes", slug)} <span aria-hidden>✕</span>
              </button>
            ))}
            {[...trainingTypes].map((slug) => (
              <button
                key={`t-${slug}`}
                onClick={() => toggleIn(setTrainingTypes, slug)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                {facetLabel("trainingTypes", slug)} <span aria-hidden>✕</span>
              </button>
            ))}
            {priceMax != null && (
              <button
                onClick={() => setPriceMax(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                Under ${priceMax.toLocaleString()} <span aria-hidden>✕</span>
              </button>
            )}
            {FLAG_FILTERS.filter((f) => flags.has(f.key)).map((f) => (
              <button
                key={`f-${f.key}`}
                onClick={() => toggleIn(setFlags, f.key)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass"
              >
                {f.label} <span aria-hidden>✕</span>
              </button>
            ))}
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
                saved={s.id ? savedIds.has(s.id) : undefined}
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
                {filtered.map((s) => (
                  <div
                    key={s.slug}
                    ref={(el) => {
                      cardRefsMobile.current[s.slug] = el;
                    }}
                    className="w-64 shrink-0"
                  >
                    <StableCard
                      s={s}
                      saved={s.id ? savedIds.has(s.id) : undefined}
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
                    saved={s.id ? savedIds.has(s.id) : undefined}
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
          <div className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-cream shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 pb-3">
              <h2 className="text-lg font-semibold text-ink">Filters</h2>
              <button onClick={resetFacets} className="text-sm font-medium text-brass">
                Reset
              </button>
            </div>

            <div className={`flex-1 space-y-4 overflow-y-auto px-4 ${NO_SCROLLBAR}`}>
              {/* Quick toggles */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Quick filters</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FLAG_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => toggleIn(setFlags, f.key)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        flags.has(f.key) ? "bg-pine text-cream" : "bg-white text-ink ring-1 ring-leather/15"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Price</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRICE_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriceMax(priceMax === p.value ? null : p.value)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        priceMax === p.value ? "bg-pine text-cream" : "bg-white text-ink ring-1 ring-leather/15"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discipline */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Discipline</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DISCIPLINES.filter((o) => o.group !== "General").map((o) => (
                    <button
                      key={o.slug}
                      onClick={() => toggleIn(setDisciplines, o.slug)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        disciplines.has(o.slug) ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Board type */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Board type</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BOARD_TYPES.map((o) => (
                    <button
                      key={o.slug}
                      onClick={() => toggleIn(setBoardTypes, o.slug)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        boardTypes.has(o.slug) ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Training */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Training</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TRAINING_TYPES.map((o) => (
                    <button
                      key={o.slug}
                      onClick={() => toggleIn(setTrainingTypes, o.slug)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        trainingTypes.has(o.slug) ? "bg-brass/15 text-brass ring-1 ring-brass/40" : "bg-white text-ink/60 ring-1 ring-leather/15"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
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
              </div>

              {/* Trust */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Trust</p>
                <button
                  onClick={() => setVerifiedOnly((v) => !v)}
                  className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                    verifiedOnly ? "bg-pine text-cream" : "bg-white text-ink ring-1 ring-leather/15"
                  }`}
                >
                  <span className={`h-3.5 w-3.5 rounded ${verifiedOnly ? "bg-brass" : "border border-leather/30"}`} />
                  Verified only
                </button>
              </div>
            </div>

            <div className="p-4 pt-3">
            <button
              onClick={() => setShowFilters(false)}
              className="w-full rounded-lg bg-pine py-3 font-semibold text-cream transition hover:bg-pine-light"
            >
              See {filtered.length} stable{filtered.length === 1 ? "" : "s"}
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
