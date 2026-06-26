import type { Metadata } from "next";
import { MapShell } from "@/components/map/MapShell";

export const metadata: Metadata = {
  title: "Map — Horse Stables Near You",
  description: "Browse horse stables and barns on the map across Florida — boarding, training, farriers, vets, tack and feed.",
};

export default function MapPage() {
  return <MapShell />;
}
