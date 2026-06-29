# Post-launch fixes & tweaks (apply after the monetization build lands)

Captured from live-site review on thestabledirectory.com. Implement in the
consolidation pass right after the monetization workflow commits (avoids
colliding with its web-file edits).

## 1. Geo-localized homepage (visitor's area first)
- Read visitor location from **Vercel IP geo headers** (`x-vercel-ip-city`,
  `x-vercel-ip-country-region`, `x-vercel-ip-latitude/longitude`) server-side.
- Homepage: a **"Stables near you"** block + **nearby-cities** list sorted by
  distance to the visitor (e.g. Pompano Beach → Fort Lauderdale, Coral Springs,
  Boca, Wellington). Keep the statewide hubs below as "Explore Florida".
- Fallback to the static hub list when geo is unknown (and for crawlers).
- SEO: geo is per-visitor only; ranking comes from the crawlable city pages —
  ensure every city has a page + footer/sitemap links (crawlable regardless of IP).

## 2. Featured-stables quality fix
- "Featured" currently surfaces high-review published listings → let a non-barn
  through (**Goat Yoga At Alaska Farms**, goat-yoga, 1,649 reviews).
- Tighten the non-barn filter (goat yoga / petting zoo / farm tour categories);
  **reject the goat-yoga record** in moderation.
- Featured should require a genuine barn: prefer claimed/verified (or hand-picked),
  exclude flagged categories, and ideally feature **local** ones (ties to #1).

## 3. Website link gated to claimed + paid (canShowWebsiteLink)
- New entitlement `canShowWebsiteLink` = tier ∈ {VERIFIED, TEAM, EVENTS}
  (implies claimed). **Unclaimed / FREE listings show NO outbound website link** —
  replace it with a **"Claim this listing"** CTA.
- Rationale: monetization hook (upgrade to drive traffic to your site) + SEO
  (no free outbound links; keep users on the directory). Asymmetric with the
  certified-badge backlink (they link to us free; we link out only when paid).
- Apply on the business detail page, card, and map API (don't expose website for
  non-entitled).

## 4. "Not a Stable or Barn" report button (crowdsourced moderation)
- Button on each listing → `POST /api/report` → record a flag (businessId, reason,
  reporter ip/userId, createdAt). Light `Report` model or reuse moderation.
- Threshold: N independent reports auto-route the business to PENDING_REVIEW
  (hide from map/featured) for admin triage; admin reject → unpublish.
- Surface reports in the admin moderation area.
