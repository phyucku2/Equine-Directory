// schema.org JSON-LD builders (design-dossier.md §5.3).
import type { BusinessDetail } from "@/lib/db/business";
import type { PublicTrainer } from "@/lib/db/trainers";
import type { PublicEvent } from "@/lib/db/events";
import { facetLabel } from "@/lib/facets";
import { absoluteUrl, businessUrl, trainerUrl, eventUrl } from "@/lib/urls";
import { showRating } from "@/lib/format";
import { SITE } from "@/lib/site";

const SITE_NAME = SITE.name;

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.url),
    })),
  };
}

export function collectionLd(name: string, url: string, businesses: { name: string; slug: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: absoluteUrl(url),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: businesses.length,
      itemListElement: businesses.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(businessUrl(b.slug)),
        name: b.name,
      })),
    },
  };
}

// FAQPage schema (Goal 5 / T44). The same Q&As must be visible on the page.
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// Article schema for the /guides long-tail content.
export function articleLd(a: { title: string; description: string; url: string; datePublished: string; dateModified?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    url: absoluteUrl(a.url),
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
  };
}

export function localBusinessLd(b: BusinessDetail) {
  const primaryCat = b.categories[0]?.category.name;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: absoluteUrl(businessUrl(b.slug)),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.streetAddress ?? undefined,
      addressLocality: b.location.name,
      addressRegion: b.location.parent?.parent?.code ?? "FL",
      postalCode: b.postalCode ?? undefined,
      addressCountry: "US",
    },
    geo: { "@type": "GeoCoordinates", latitude: b.latitude, longitude: b.longitude },
  };
  if (b.description) ld.description = b.description;
  if (b.phone) ld.telephone = b.phone;
  if (b.website) ld.sameAs = [b.website];
  if (primaryCat) ld.additionalType = primaryCat;
  const photos = b.images.filter((i) => !i.isLogo);
  if (photos.length) ld.image = photos.map((i) => i.url);
  if (b.rating != null && showRating(b.reviewCount)) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(b.rating).toFixed(1),
      reviewCount: b.reviewCount,
    };
  }
  if (b.reviews.length) {
    ld.review = b.reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      reviewRating: { "@type": "Rating", ratingValue: r.rating },
      reviewBody: r.content,
    }));
  }
  return ld;
}

// schema.org Person for a trainer profile (monetization-tiers.md §"Public display").
export function trainerLd(
  trainer: PublicTrainer,
  business: { name: string; slug: string },
) {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: trainer.name,
    url: absoluteUrl(trainerUrl(business.slug, trainer.slug)),
    worksFor: { "@type": "Organization", name: business.name, url: absoluteUrl(businessUrl(business.slug)) },
  };
  if (trainer.bio) ld.description = trainer.bio;
  if (trainer.photoUrl) ld.image = trainer.photoUrl;
  if (trainer.email) ld.email = trainer.email;
  if (trainer.phone) ld.telephone = trainer.phone;
  const knows = trainer.disciplines.map((d) => facetLabel("disciplines", d));
  if (knows.length) ld.knowsAbout = knows;
  return ld;
}

// schema.org Event for a dated event/show/clinic/camp (Event JSON-LD, dated).
export function eventLd(event: PublicEvent) {
  const url = absoluteUrl(eventUrl(event.business.slug, event.slug));
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    url,
    startDate: event.startDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: event.business.name,
      url: absoluteUrl(businessUrl(event.business.slug)),
    },
  };
  if (event.endDate) ld.endDate = event.endDate.toISOString();
  if (event.description) ld.description = event.description;
  if (event.imageUrl) ld.image = event.imageUrl;
  if (event.location) {
    ld.location = {
      "@type": "Place",
      name: event.location.name,
      address: { "@type": "PostalAddress", addressLocality: event.location.name, addressRegion: "FL", addressCountry: "US" },
    };
  }
  if (event.price != null) {
    ld.offers = {
      "@type": "Offer",
      price: (event.price / 100).toFixed(2),
      priceCurrency: "USD",
      url: event.registrationUrl ?? url,
      availability: "https://schema.org/InStock",
    };
  }
  return ld;
}
