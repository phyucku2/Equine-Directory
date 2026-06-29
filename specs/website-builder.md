# Website Builder Pipeline — Spec

Productized barn websites ($99–299 one-time build + $49.99/yr managed
hosting/maintenance). The key automation: **the claimed listing already holds
~80% of the content** (name, NAP, photos, logo, facets, pricing, trainers,
events, reviews), so we pre-fill everything and the owner just confirms + brands.

## Locked decisions
1. **Multi-tenant single app** — one "sites" app serves every barn site; host → tenant → themed template. Central template/SEO upkeep = the $49.99/yr is profitable.
2. **Pre-filled intake form** (from the listing), not a blank document. (Optional: accept an uploaded doc and LLM-parse into the same fields.)
3. **Multiple template choices** — owner picks from a small gallery; each is brand-themed from their assets.
4. **We manage DNS** — owner delegates their registrar **nameservers to us** (Vercel DNS); we then control records + SSL via the Vercel API. Premium, sticky, low-support.
5. **Subdomain by default** (`barnname.thestabledirectory.com`) + optional **custom domain**.

## Pipeline (auto vs manual)
1. **Intake — auto pre-fill.** Generate a form seeded from the listing; owner edits + adds tagline, About story, page selection, desired domain. (Upload-doc fallback → LLM extract.)
2. **Brand — auto.** Extract a color palette from the **logo** (node-vibrant/sharp) → theme tokens (primary/secondary/bg/text) with contrast checks; owner nudges. Reuse listing photos (best → hero, rest → gallery) + logo. Default font pairing.
3. **Template — choice.** Owner picks a template; it's populated programmatically from listing data (Home, Boarding+pricing, Training/Lessons+trainers, Camps/Events, Gallery, Reviews, Contact+map+hours). Pages render only when data exists.
4. **SEO — auto.** Per-site schema.org `LocalBusiness`/`EquestrianFacility` JSON-LD, meta/OG (auto OG image from hero), sitemap, fast mobile render, **consistent NAP** from the listing, and cross-links directory ⇄ site (link equity).
5. **Deploy — auto.** Live instantly on the subdomain.
6. **Custom domain — semi-auto (we manage).** Owner moves nameservers to us (one-time, guided); we add the domain to the project + records via Vercel API; SSL auto. ("Manual domain transfer" → "we handle DNS once you delegate.")

## Architecture
- **Multi-tenant Next app** (could be a route group in the existing app or a sibling app). Middleware resolves the request `host` → `Site` tenant config → renders the chosen template with the tenant's theme + content.
- Content is read from the existing `Business` (+ trainers/events/reviews/facets) by `businessId`, so sites stay auto-current with the listing — and a managed barn's site updates when its listing does.

## Data model (additive)
- **`Site`** — id, businessId(→Business, unique), subdomain (unique), customDomain? (unique), templateId, theme Json ({colors, font}), pages Json (which pages + order + custom copy/tagline/about), status (DRAFT/LIVE/SUSPENDED), dnsManaged Boolean, createdAt/updatedAt.
- Reuse `Business` photos/logo/facets/trainers/events/reviews for content (no duplication).
- Billing: `Purchase` for the one-time build ($99–299) + a recurring maintenance line ($49.99/yr) as a `Subscription` add-on or annual `Purchase`. Behind `BILLING_ENABLED`; admin can grant in beta.

## Components to build
- **Tenant resolver/middleware** (host → Site).
- **Template renderer** + a few template components, themed by `Site.theme`.
- **Intake form** (pre-filled from listing) → writes `Site`.
- **Logo→palette extractor** (server util).
- **SEO module** per tenant (JSON-LD, meta, sitemap, OG).
- **Domain/DNS integration** (Vercel API: add domain, records; nameserver-delegation flow + status checks).
- **Owner UI:** "Website" tab — start build, pick template, edit brand/pages, connect domain, view status.
- **Admin:** provision/suspend a site, manage domains, grant the build in beta.

## Phasing (future ultracode build — after monetization tiers land)
1. `Site` model + tenant resolver + theme/palette util + migration.
2. Template renderer + 2–3 starter templates (populated from listing).
3. Intake form + owner "Website" tab + admin provisioning.
4. SEO module + sitemap + cross-linking.
5. Domain/DNS (Vercel API) + nameserver-delegation flow.
6. Billing ($99–299 build + $49.99/yr) behind the flag.

## Open later
- Exact template count/styles; per-page custom-copy depth; whether to run sites in the main app vs a dedicated app; CDN/image handling for tenant photos.
</content>
