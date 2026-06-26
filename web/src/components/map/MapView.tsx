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

// Free, no-key, street-level basemap. Swappable for MapTiler/Google later.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Broward / South Florida default view.
const DEFAULT_CENTER: [number, number] = [-80.25, 26.12];
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [items, setItems] = useState<StableMarker[]>([]);
  const [selected, setSelected] = useState<StableMarker | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      "top-left",
    );

    Promise.all([
      fetch("/api/map").then((r) => r.json()),
      new Promise<void>((res) => map.on("load", () => res())),
    ])
      .then(([geo]) => {
        if (cancelled) return;
        const features = (geo.features ?? []) as Array<{
          geometry: { coordinates: [number, number] };
          properties: Omit<StableMarker, "lng" | "lat">;
        }>;
        setItems(
          features.map((f) => ({
            ...f.properties,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        );
        setLoading(false);

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
          id: "cluster-count",
          type: "symbol",
          source: "stables",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#f7f3ec" },
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
          const clusterId = f[0].properties?.cluster_id;
          const src = map.getSource("stables") as maplibregl.GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: (f[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
        map.on("click", "point", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Omit<StableMarker, "lng" | "lat">;
          const c = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          setSelected({ ...p, rating: p.rating ?? null, lng: c[0], lat: c[1] });
        });
        for (const layer of ["clusters", "point"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
      })
      .catch(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Map/List toggle + count */}
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
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-leather/15 bg-cream/95 p-3 shadow-2xl backdrop-blur">
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
