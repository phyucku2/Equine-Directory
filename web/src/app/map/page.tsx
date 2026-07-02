import type { Metadata } from "next";
import { MapShell } from "@/components/map/MapShell";

export const metadata: Metadata = {
  title: "Map — Horse Stables Near You",
  description: "Browse horse stables and barns on the map — boarding, training, and facilities nationwide.",
};

export default function MapPage() {
  return <MapShell />;
}
