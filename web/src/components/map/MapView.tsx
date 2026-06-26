"use client";

import { useEffect, useRef, useState } from "react";
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
  lng: number;
  lat: number;
};

// Inline raster basemap (CARTO Voyager) — reliable, no key, no glyph/sprite
// dependencies (the vector-style approach failed to load). Swappable later.
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
        {s.category && <p className="truncate text-xs text-ink/55">{s.category}</p>}
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
  const [items, setItems] = useState<StableMarker[]>([]);
  const [selected, setSelected] = useState<StableMarker | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geo: any = null;

    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-left",
    );
    map.on("error", (e) => console.error("[map]", e?.error?.message ?? e));

    const addData = () => {
      if (cancelled || !geo || !map.isStyleLoaded() || map.getSource("stables")) return;
      map.addSource("stables", {
        type: "geojson",
        data: geo,
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
        const f = e.features?.[0];
        if (!f) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = f.properties as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (f.geometry as any).coordinates as [number, number];
        setSelected({ ...p, rating: p.rating ?? null, lng: c[0], lat: c[1] });
      });
      for (const layer of ["clusters", "point"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    };

    map.on("load", () => {
      map.resize();
      addData();
    });

    fetch("/api/map")
      .then((r) => r.json())
      .then((g) => {
        if (cancelled) return;
        geo = g;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const features = (g.features ?? []) as any[];
        setItems(
          features.map((f) => ({
            ...f.properties,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        );
        setLoading(false);
        addData();
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
    };
  }, []);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] min-h-[420px] w-full overflow-hidden bg-cream-dark">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Count + Map/List toggle */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-center justify-between px-3">
        <span className="pointer-events-auto rounded-full bg-cream/90 px-3 py-1.5 text-sm font-medium text-pine shadow backdrop-blur">
          {loading ? "Loading…" : `${items.length} stable${items.length === 1 ? "" : "s"}`}
        </span>
        <div className="pointer-events-auto inline-flex overflow-hidden rounded-full bg-cream/90 shadow backdrop-blur">
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 text-sm font-medium ${view === "map" ? "bg-pine text-cream" : "text-pine"}`}
          >
            Map
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-pine text-cream" : "text-pine"}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Selected stable card (map view) */}
      {view === "map" && selected && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="mx-auto max-w-xl">
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="mb-1 ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-cream/90 text-pine shadow backdrop-blur"
            >
              ✕
            </button>
            <MiniCard s={selected} />
          </div>
        </div>
      )}

      {/* List view (bottom sheet) */}
      {view === "list" && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[72%] overflow-y-auto rounded-t-2xl border-t border-leather/15 bg-cream/95 p-3 shadow-2xl backdrop-blur">
          <div className="mx-auto grid max-w-3xl gap-2.5 sm:grid-cols-2">
            {items.length === 0 && !loading && (
              <p className="col-span-full py-8 text-center text-sm text-ink/55">No stables to show yet.</p>
            )}
            {items.map((s) => (
              <MiniCard key={s.slug} s={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
