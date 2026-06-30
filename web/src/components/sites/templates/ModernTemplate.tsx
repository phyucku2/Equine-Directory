// "Modern" starter template (specs/website-builder.md §Components).
//
// A clean, contemporary barn site: split hero (copy beside the photo), a slim
// sticky-feeling header, generous whitespace, and the same data-gated sections as
// Classic (Boarding+pricing, Training/Lessons+trainers, Camps/Events, Gallery,
// Reviews, Contact+map+hours). Sections render only when their data exists.
//
// React server component, themed from `props.theme` via CSS custom properties.

import type { ReactElement } from "react";
import type { Template, TemplateProps } from "@/lib/sites/templates/types";
import {
  themeStyle,
  Stars,
  GallerySection,
  ReviewsSection,
  ContactSection,
  BoardingSection,
  ProgramsSection,
  EventsSection,
  TrainersSection,
  FacetsSection,
} from "./shared";

function ModernTemplate(props: TemplateProps): ReactElement {
  const { name, city, region, tagline, about, theme, logo, hero, contact, rating, reviewCount } =
    props;
  const place = [city, region].filter(Boolean).join(", ");

  return (
    <div
      style={themeStyle(theme)}
      className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)] antialiased"
    >
      {/* Slim header */}
      <header className="sticky top-0 z-10 border-b border-[var(--site-primary)]/10 bg-[var(--site-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.url} alt={logo.alt} className="h-9 w-9 rounded-lg object-contain" />
            )}
            <span className="text-lg font-bold tracking-tight text-[var(--site-primary)]">
              {name}
            </span>
          </div>
          {contact.phoneHref && (
            <a
              href={contact.phoneHref}
              className="rounded-full border border-[var(--site-primary)]/30 px-4 py-1.5 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary)] hover:text-white"
            >
              {contact.phone}
            </a>
          )}
        </div>
      </header>

      {/* Split hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
        <div>
          {place && (
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--site-secondary)]">
              {place}
            </p>
          )}
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--site-primary)] sm:text-6xl">
            {name}
          </h1>
          {tagline && <p className="mt-5 max-w-md text-lg opacity-75">{tagline}</p>}
          {rating && (
            <div className="mt-5 flex items-center gap-2">
              <Stars value={Math.round(Number(rating))} />
              <span className="text-sm opacity-70">
                {rating} · {reviewCount} reviews
              </span>
            </div>
          )}
          {contact.phoneHref && (
            <a
              href={contact.phoneHref}
              className="mt-7 inline-block rounded-full bg-[var(--site-primary)] px-7 py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Get in touch
            </a>
          )}
        </div>
        {hero && (
          <div className="overflow-hidden rounded-3xl shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.url}
              alt={hero.alt}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}
      </section>

      <main className="mx-auto max-w-6xl space-y-20 px-6 pb-24">
        {about && (
          <section className="max-w-3xl">
            <h2 className="text-2xl font-bold text-[var(--site-primary)]">About</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-relaxed opacity-80">{about}</p>
          </section>
        )}

        <BoardingSection {...props} variant="modern" />
        <FacetsSection {...props} variant="modern" />
        <TrainersSection {...props} variant="modern" />
        <ProgramsSection {...props} variant="modern" />
        <EventsSection {...props} variant="modern" />
        <GallerySection {...props} variant="modern" />
        <ReviewsSection {...props} variant="modern" />
        <ContactSection {...props} variant="modern" />
      </main>

      <footer className="border-t border-[var(--site-primary)]/10 py-10 text-center text-sm opacity-60">
        © {new Date().getFullYear()} {name}
        {place ? ` · ${place}` : ""}
      </footer>
    </div>
  );
}

export const modernTemplate: Template = {
  id: "modern",
  name: "Modern",
  render: (props) => <ModernTemplate {...props} />,
};
