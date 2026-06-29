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

export function countyUrl(stateSlug: string, countySlug: string): string {
  return `/locations/${stateSlug}/${countySlug}`;
}

export function cityUrl(stateSlug: string, countySlug: string, citySlug: string): string {
  return `/locations/${stateSlug}/${countySlug}/${citySlug}`;
}

// Programmatic intent page: e.g. /horse-boarding/florida/marion/ocala
export function intentUrl(
  categorySlug: string,
  stateSlug: string,
  countySlug: string,
  citySlug: string,
): string {
  return `/${categorySlug}/${stateSlug}/${countySlug}/${citySlug}`;
}

export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
