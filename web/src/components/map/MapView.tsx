"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type StableMarker = {
  slug: string;
  name: string;
  city: string;
  category: string;
  rating: number | null;
  reviewCount: number;
  image: string | null;
  featured: boolean;
  verified: boolean;
  lng: number;
  lat: number;
};

// Inline raster basemap (CARTO Voyager) — reliable, no key, no glyph deps.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: "basemap", type: "raster", source: "basemap" }],
};
const DEFAULT_CENTER: [number, number] = [-80.25, 26.12]; // Broward / South FL
const DEFAULT_ZOOM = 9;
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFeatureCollection(items: StableMarker[]): any {
  return {
    type: "FeatureCollection",
    features: items.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { slug: s.slug },
    })),
  };
}

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating == null) return <span className="text-xs text-ink/45">No rating yet</span>;
  return (
    <span className="text-xs text-ink/60">
      <span className="text-brass">★</span> {rating.toFixed(1)}
      {count > 0 && <span className="text-ink/45"> ({count})</span>}
    </span>
  );
}

function MiniCard({ s }: { s: StableMarker }) {
  return (
    <Link
      href={`/business/${s.slug}`}
      className="flex gap-3 rounded-xl border border-leather/15 bg-white p-2.5 shadow-sm transition hover:border-brass"
    >
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-cream-dark">
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.image} alt={s.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-leather/25">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
              <path d="M4 18V8l8-4 8 4v10h-5v-6H9v6H4z" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm font-semibold text-pine">{s.name}</p>
        <p className="truncate text-xs text-ink/55">{s.city}</p>
        <div className="mt-0.5">
          <Stars rating={s.rating} count={s.reviewCount} />
        </div>
      </div>
    </Link>
  );
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);

  const [items, setItems] = useState<StableMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;
    map.on("error", (e) => {
      const msg = e?.error?.message ?? "unknown map error";
      console.error("[map]", msg);
      // Ignore transient single-tile failures; surface anything else.
      if (!/tile|abort/i.test(msg)) setMapError(msg);
    });

    const setup = (data: StableMarker[]) => {
      if (cancelled || map.getSource("stables")) return;
      map.addSource("stables", {
        type: "geojson",
        data: toFeatureCollection(data),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stables",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#22382c",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#cda35a",
        },
      });
      map.addLayer({
        id: "point",
        type: "circle",
        source: "stables",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#b8893b",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#22382c",
        },
      });
      map.on("click", "clusters", async (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = f[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const src = map.getSource("stables") as maplibregl.GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(clusterId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.easeTo({ center: (f[0].geometry as any).coordinates, zoom });
      });
      map.on("click", "point", (e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (e.features?.[0]?.geometry as any)?.coordinates;
        if (c) map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 12) });
      });
      for (const layer of ["clusters", "point"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      readyRef.current = true;
    };

    let loaded: StableMarker[] | null = null;
    map.on("load", () => {
      map.resize();
      if (loaded) setup(loaded);
    });

    fetch("/api/map")
      .then((r) => r.json())
      .then((g) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: StableMarker[] = (g.features ?? []).map((f: any) => ({
          ...f.properties,
          rating: f.properties.rating ?? null,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }));
        loaded = list;
        setItems(list);
        setLoading(false);
        if (map.isStyleLoaded()) setup(list);
      })
      .catch((err) => {
        console.error("[map] data", err);
        if (!cancelled) setLoading(false);
      });

    const t = setTimeout(() => map.resize(), 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("stables") as maplibregl.GeoJSONSource | undefined;
    src?.setData(toFeatureCollection(filtered));
  }, [filtered]);

  const nearMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 11 }),
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-cream-dark">
      <div ref={containerRef} className="absolute inset-0" />

      {/* On-screen error readout (diagnostic) */}
      {mapError && (
        <div className="absolute bottom-2 left-2 right-2 z-40 rounded-lg bg-red-900/90 px-3 py-2 text-xs text-white">
          Map error: {mapError}
        </div>
      )}

      {/* TOP: home + search + filter */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-2 p-2">
        <Link
          href="/"
          aria-label="Home"
          className="flex shrink-0 items-center rounded-full border border-leather/15 bg-white px-3 text-pine shadow"
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
          className="w-full rounded-full border border-leather/15 bg-white px-4 py-2.5 text-sm shadow focus:outline-none focus:ring-2 focus:ring-brass"
        />
        <button
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
          className="relative shrink-0 rounded-full border border-leather/15 bg-white px-3 shadow"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-pine" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
          </svg>
          {activeFilters > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brass text-[10px] font-bold text-pine">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Near-me */}
      {view === "map" && (
        <button
          onClick={nearMe}
          aria-label="Near me"
          className="absolute bottom-44 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-pine shadow"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* BOTTOM preview window */}
      {view === "map" && (
        <div className="absolute inset-x-0 bottom-0 z-20 pb-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="rounded-full bg-cream/90 px-3 py-1 text-sm font-medium text-pine shadow backdrop-blur">
              {loading ? "Loading…" : `${filtered.length} stable${filtered.length === 1 ? "" : "s"}`}
            </span>
            <button
              onClick={() => setView("list")}
              className="rounded-full bg-cream/90 px-3 py-1 text-sm font-medium text-pine shadow backdrop-blur"
            >
              List ▤
            </button>
          </div>
          <div className={`flex gap-3 overflow-x-auto px-3 pb-1 ${NO_SCROLLBAR}`}>
            {!loading && filtered.length === 0 && (
              <div className="w-full rounded-xl bg-white/95 p-4 text-center text-sm text-ink/55 shadow">
                No stables match these filters.
              </div>
            )}
            {filtered.slice(0, 60).map((s) => (
              <div key={s.slug} className="w-72 shrink-0">
                <MiniCard s={s} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIST view */}
      {view === "list" && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-cream p-3 pt-16">
          <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center justify-between bg-cream/95 px-3 py-2 backdrop-blur">
            <span className="text-sm font-medium text-pine">
              {filtered.length} stable{filtered.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => setView("map")}
              className="rounded-full bg-pine px-3 py-1 text-sm font-medium text-cream shadow"
            >
              Map ◎
            </button>
          </div>
          <div className="mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-2">
            {filtered.map((s) => (
              <MiniCard key={s.slug} s={s} />
            ))}
          </div>
        </div>
      )}

      {/* Filter sheet */}
      {showFilters && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/30" onClick={() => setShowFilters(false)}>
          <div className="w-full rounded-t-2xl bg-cream p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-pine">Filters</h2>
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
                    minRating === r ? "bg-pine text-cream" : "bg-white text-pine ring-1 ring-leather/15"
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
                verifiedOnly ? "bg-pine text-cream" : "bg-white text-pine ring-1 ring-leather/15"
              }`}
            >
              <span className={`h-3.5 w-3.5 rounded ${verifiedOnly ? "bg-brass" : "border border-leather/30"}`} />
              Verified only
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="mt-5 w-full rounded-lg bg-brass py-3 font-semibold text-pine transition hover:bg-brass-light"
            >
              See {filtered.length} stable{filtered.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
