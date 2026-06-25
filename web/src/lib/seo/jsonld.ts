// schema.org JSON-LD builders (design-dossier.md §5.3).
import type { BusinessDetail } from "@/lib/db/business";
import { absoluteUrl, businessUrl } from "@/lib/urls";
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
  if (b.images.length) ld.image = b.images.map((i) => i.url);
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
