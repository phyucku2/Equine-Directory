// Canonical URL builders. Keep all internal links going through these so URL
// structure stays consistent (design-dossier.md §5.1).

export function businessUrl(slug: string): string {
  return `/business/${slug}`;
}

export function categoryUrl(slug: string): string {
  return `/categories/${slug}`;
}

export function trainersUrl(businessSlug: string): string {
  return `/business/${businessSlug}/trainers`;
}

export function trainerUrl(businessSlug: string, trainerSlug: string): string {
  return `/business/${businessSlug}/trainers/${trainerSlug}`;
}

export function eventsUrl(): string {
  return `/events`;
}

export function eventUrl(businessSlug: string, eventSlug: string): string {
  return `/events/${businessSlug}/${eventSlug}`;
}

export function stateUrl(stateSlug: string): string {
  return `/locations/${stateSlug}`;
}

// County and city hubs share the flat `/locations/[state]/[place]` level (the
// [place] route resolves a slug to a city first, then a county). Counties were
// already at this level; cities moved up here (dropping the county segment) in
// the Zillow-model URL flattening — cities are the SEO-primary hub.
export function countyUrl(stateSlug: string, countySlug: string): string {
  return `/locations/${stateSlug}/${countySlug}`;
}

export function cityUrl(stateSlug: string, citySlug: string): string {
  return `/locations/${stateSlug}/${citySlug}`;
}

// Programmatic intent page: e.g. /horse-boarding/florida/ocala
export function intentUrl(categorySlug: string, stateSlug: string, citySlug: string): string {
  return `/${categorySlug}/${stateSlug}/${citySlug}`;
}

// Statewide category pillar (SEO Lever 2): e.g. /horse-boarding/florida
export function categoryStateUrl(categorySlug: string, stateSlug: string): string {
  return `/${categorySlug}/${stateSlug}`;
}

export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
