// "Classic" starter template (specs/website-builder.md §Components).
//
// A warm, traditional single-page barn site: full-width hero, then stacked
// sections (Boarding+pricing, Training/Lessons+trainers, Camps/Events, Gallery,
// Reviews, Contact+map+hours). Every section renders only when its data exists.
//
// React server component. Themed entirely from `props.theme` via CSS custom
// properties on the root, so the same component renders any barn's brand colours
// without dynamic Tailwind classes. The directory's Tailwind tokens aren't used
// here on purpose — a tenant site is the barn's brand, not ours.

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

function ClassicTemplate(props: TemplateProps): ReactElement {
  const { name, city, region, tagline, about, theme, logo, hero } = props;
  const place = [city, region].filter(Boolean).join(", ");

  return (
    <div
      style={themeStyle(theme)}
      className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)] antialiased"
    >
      {/* Header */}
      <header className="border-b border-[var(--site-primary)]/15">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-5">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.url} alt={logo.alt} className="h-12 w-12 rounded-full object-contain" />
          )}
          <div>
            <p className="text-xl font-semibold tracking-tight text-[var(--site-primary)]">{name}</p>
            {place && <p className="text-sm opacity-70">{place}</p>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {hero ? (
          <div className="relative h-[60vh] min-h-[360px] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero.url} alt={hero.alt} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 flex items-center">
              <div className="mx-auto w-full max-w-5xl px-6 text-white">
                <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">{name}</h1>
                {tagline && <p className="mt-4 max-w-xl text-lg opacity-90">{tagline}</p>}
                {props.contact.phoneHref && (
                  <a
                    href={props.contact.phoneHref}
                    className="mt-6 inline-block rounded-full bg-[var(--site-primary)] px-6 py-3 font-semibold text-white shadow-lg transition hover:opacity-90"
                  >
                    Call {props.contact.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--site-primary)] py-20 text-center text-white">
            <div className="mx-auto max-w-3xl px-6">
              <h1 className="text-4xl font-bold sm:text-5xl">{name}</h1>
              {tagline && <p className="mt-4 text-lg opacity-90">{tagline}</p>}
            </div>
          </div>
        )}
      </section>

      <main className="mx-auto max-w-5xl space-y-16 px-6 py-16">
        {/* About */}
        {about && (
          <section>
            <h2 className="text-2xl font-bold text-[var(--site-primary)]">About {name}</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-line text-lg leading-relaxed opacity-80">
              {about}
            </p>
            {props.rating && (
              <div className="mt-4 flex items-center gap-2">
                <Stars value={Math.round(Number(props.rating))} />
                <span className="text-sm opacity-70">
                  {props.rating} · {props.reviewCount} reviews
                </span>
              </div>
            )}
          </section>
        )}

        <BoardingSection {...props} variant="classic" />
        <FacetsSection {...props} variant="classic" />
        <TrainersSection {...props} variant="classic" />
        <ProgramsSection {...props} variant="classic" />
        <EventsSection {...props} variant="classic" />
        <GallerySection {...props} variant="classic" />
        <ReviewsSection {...props} variant="classic" />
        <ContactSection {...props} variant="classic" />
      </main>

      <footer className="border-t border-[var(--site-primary)]/15 py-8 text-center text-sm opacity-60">
        © {new Date().getFullYear()} {name}
        {place ? ` · ${place}` : ""}
      </footer>
    </div>
  );
}

export const classicTemplate: Template = {
  id: "classic",
  name: "Classic",
  render: (props) => <ClassicTemplate {...props} />,
};
