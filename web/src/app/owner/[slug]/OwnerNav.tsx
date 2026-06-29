"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Per-barn sub-navigation. Highlights the active section. The "Team" tab is only
// rendered when `showTeam` (OWNER/ADMIN) — passed from the server layout.
const TABS: { seg: string; label: string }[] = [
  { seg: "", label: "Preview" },
  { seg: "details", label: "Details" },
  { seg: "listing", label: "Listing" },
  { seg: "boarding", label: "Boarding" },
  { seg: "disciplines", label: "Disciplines" },
  { seg: "programs", label: "Programs" },
  { seg: "facility", label: "Facility" },
  { seg: "photos", label: "Photos" },
  { seg: "hours", label: "Hours" },
  { seg: "reviews", label: "Reviews & inbox" },
];

export function OwnerNav({ slug, showTeam }: { slug: string; showTeam: boolean }) {
  const pathname = usePathname();
  const base = `/owner/${slug}`;
  const tabs = showTeam ? [...TABS, { seg: "team", label: "Team" }] : TABS;

  return (
    <nav className="-mb-px flex flex-wrap gap-1 border-b border-leather/15">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={t.seg || "preview"}
            href={href}
            className={`rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-brass text-pine"
                : "border-transparent text-ink/55 hover:text-pine"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
