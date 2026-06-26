"use client";

import dynamic from "next/dynamic";

// maplibre-gl is browser-only — load it client-side to avoid SSR errors.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center text-ink/55">
      Loading map…
    </div>
  ),
});

export function MapShell() {
  return <MapView />;
}
