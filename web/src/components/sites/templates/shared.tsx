// Shared, theme-aware section components for the tenant site templates
// (specs/website-builder.md §Components). Each section is a pure function of
// `TemplateProps` and renders NOTHING when its underlying data is absent — so a
// template can drop them all in and pages/sections appear only when the listing
// has content.
//
// Theming: `themeStyle(theme)` puts the four brand tokens onto CSS custom
// properties (--site-primary / --site-secondary / --site-bg / --site-text); the
// markup styles itself with `[var(--site-*)]` utility classes. The `variant`
// prop ("classic" | "modern") lets a template tweak spacing/headers without
// duplicating the data-gating logic.
//
// React server components — no client hooks, no Prisma; props are plain data.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { TemplateProps } from "@/lib/sites/templates/types";
import type { ThemeTokens } from "@/lib/sites/palette";

export type Variant = "classic" | "modern";

/** Map theme tokens onto CSS variables the template markup reads. */
export function themeStyle(theme: ThemeTokens): CSSProperties {
  return {
    ["--site-primary" as string]: theme.primary,
    ["--site-secondary" as string]: theme.secondary,
    ["--site-bg" as string]: theme.bg,
    ["--site-text" as string]: theme.text,
  } as CSSProperties;
}

/** Section heading shared by both variants. */
function Heading({ children }: { children: ReactNode }): ReactElement {
  return <h2 className="text-2xl font-bold text-[var(--site-primary)]">{children}</h2>;
}

/** Star row using the primary accent. */
export function Stars({ value }: { value: number }): ReactElement {
  const n = Math.max(0, Math.min(5, value));
  return (
    <span aria-label={`${n} out of 5 stars`} className="text-[var(--site-secondary)]">
      {"★".repeat(n)}
      <span className="opacity-30">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** A pine-style brand chip. */
function Chip({ children }: { children: ReactNode }): ReactElement {
  return (
    <span className="rounded-full bg-[var(--site-primary)]/8 px-3 py-1 text-sm text-[var(--site-primary)] ring-1 ring-[var(--site-primary)]/15">
      {children}
    </span>
  );
}

// ─────────────────────────── Boarding + pricing ───────────────────────────
export function BoardingSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  const { boarding, facts } = props;
  if (boarding.length === 0 && facts.length === 0) return null;
  return (
    <section>
      <Heading>Boarding &amp; pricing</Heading>
      {facts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6">
          {facts.map((f) => (
            <div key={f.label}>
              <span className="text-2xl font-bold text-[var(--site-primary)]">{f.value}</span>{" "}
              <span className="text-sm opacity-60">{f.label}</span>
            </div>
          ))}
        </div>
      )}
      {boarding.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {boarding.map((b) => (
            <div
              key={b.label}
              className="rounded-2xl border border-[var(--site-primary)]/12 bg-white/60 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[var(--site-primary)]">{b.label}</p>
                {b.price && (
                  <span className="shrink-0 font-semibold">{b.price}</span>
                )}
              </div>
              {b.included.length > 0 && (
                <p className="mt-2 text-sm opacity-60">Includes: {b.included.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── Facet chip groups ───────────────────────────
export function FacetsSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.facets.length === 0) return null;
  return (
    <section>
      <Heading>Disciplines &amp; programs</Heading>
      <div className="mt-5 space-y-5">
        {props.facets.map((g) => (
          <div key={g.label}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-55">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.values.map((v) => (
                <Chip key={v}>{v}</Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── Training / Lessons — trainers ───────────────────
export function TrainersSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.trainers.length === 0) return null;
  return (
    <section>
      <Heading>Training &amp; lessons</Heading>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {props.trainers.map((t) => (
          <div key={t.id} className="flex gap-4 rounded-2xl border border-[var(--site-primary)]/12 bg-white/60 p-5">
            {t.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.photoUrl}
                alt={t.name}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-[var(--site-primary)]">{t.name}</p>
              {t.disciplines.length > 0 && (
                <p className="mt-0.5 text-sm text-[var(--site-secondary)]">
                  {t.disciplines.join(" · ")}
                </p>
              )}
              {t.bio && <p className="mt-2 text-sm opacity-75">{t.bio}</p>}
              {t.certifications.length > 0 && (
                <p className="mt-2 text-xs opacity-55">{t.certifications.join(" · ")}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── Camps / Programs ───────────────────────────
export function ProgramsSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.programs.length === 0) return null;
  return (
    <section>
      <Heading>Camps &amp; programs</Heading>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {props.programs.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[var(--site-primary)]/12 bg-white/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-[var(--site-primary)]">{p.name}</p>
              {p.price && <span className="shrink-0 font-semibold">{p.price}</span>}
            </div>
            <p className="mt-0.5 text-sm text-[var(--site-secondary)]">{p.typeLabel}</p>
            {p.detail && <p className="mt-1 text-sm opacity-60">{p.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── Events ───────────────────────────
export function EventsSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.events.length === 0) return null;
  return (
    <section>
      <Heading>Upcoming events</Heading>
      <ul className="mt-6 space-y-4">
        {props.events.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--site-primary)]/12 bg-white/60 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="font-semibold text-[var(--site-primary)]">{e.title}</p>
                {e.typeLabel && (
                  <span className="text-xs uppercase tracking-wide text-[var(--site-secondary)]">
                    {e.typeLabel}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm opacity-70">
                {e.dateLabel}
                {e.price ? ` · ${e.price}` : ""}
              </p>
              {e.description && <p className="mt-1 text-sm opacity-60">{e.description}</p>}
            </div>
            {e.registrationUrl && (
              <a
                href={e.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Register
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────── Gallery ───────────────────────────
export function GallerySection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.gallery.length === 0) return null;
  return (
    <section>
      <Heading>Gallery</Heading>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {props.gallery.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.url}
            src={img.url}
            alt={img.alt}
            className="aspect-[4/3] w-full rounded-xl object-cover"
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── Reviews ───────────────────────────
export function ReviewsSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  if (props.reviews.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <Heading>Reviews</Heading>
        {props.rating && (
          <span className="text-sm opacity-70">
            {props.rating} ★ · {props.reviewCount} reviews
          </span>
        )}
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {props.reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border border-[var(--site-primary)]/12 bg-white/60 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--site-primary)]">{r.authorName}</span>
              <Stars value={r.rating} />
            </div>
            {r.title && <p className="mt-1 font-medium opacity-80">{r.title}</p>}
            <p className="mt-1 text-sm opacity-75">{r.content}</p>
            {r.ownerResponse && (
              <div className="mt-3 rounded-lg bg-[var(--site-primary)]/6 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--site-primary)]">
                  Response from {props.name}
                </p>
                <p className="mt-1 text-sm opacity-75">{r.ownerResponse}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────── Contact + map + hours ───────────────────────────
export function ContactSection(props: TemplateProps & { variant: Variant }): ReactElement | null {
  const { contact, mapHref, hours, name } = props;
  // Always render contact (NAP) — it's the core of a barn site — but each row gates.
  const hasAnything =
    contact.phone || contact.email || contact.address || contact.website || hours.length > 0;
  if (!hasAnything) return null;
  return (
    <section>
      <Heading>Contact</Heading>
      <div className="mt-6 grid gap-8 sm:grid-cols-2">
        <div className="space-y-3 text-sm">
          {contact.address && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Address</p>
              <p className="mt-1 opacity-80">{contact.address}</p>
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[var(--site-secondary)] hover:underline"
                >
                  View on map →
                </a>
              )}
            </div>
          )}
          {contact.phoneHref && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Phone</p>
              <a href={contact.phoneHref} className="mt-1 inline-block opacity-80 hover:underline">
                {contact.phone}
              </a>
            </div>
          )}
          {contact.email && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Email</p>
              <a
                href={`mailto:${contact.email}`}
                className="mt-1 inline-block opacity-80 hover:underline"
              >
                {contact.email}
              </a>
            </div>
          )}
          {contact.website && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Website</p>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[var(--site-secondary)] hover:underline"
              >
                {contact.website}
              </a>
            </div>
          )}
        </div>

        {hours.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-55">Hours</p>
            <ul className="mt-2 space-y-1 text-sm">
              {hours.map((d) => {
                const [day, ...rest] = d.split(": ");
                return (
                  <li key={d} className="flex justify-between gap-3">
                    <span className="opacity-55">{day}</span>
                    <span className="text-right opacity-80">{rest.join(": ")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-8 text-xs opacity-50">
        {name} · Site by{" "}
        <a href="https://thestabledirectory.com" className="hover:underline">
          The Stable Directory
        </a>
      </p>
    </section>
  );
}
