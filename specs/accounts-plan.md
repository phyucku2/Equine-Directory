# Equine Directory — End-to-End Accounts Build Plan

This is the lead-architect synthesis of four design memos, the repo inventory, and an adversarial review, sequenced for this exact codebase (`web/`, Next.js 16, `next-auth@5.0.0-beta.31`, Prisma 6, Postgres/Neon — all paths verified). It builds three account types on one `User` table: a free-forever horse-owner (consumer) experience modeled on Zillow, a barn-owner dashboard that writes the exact fields the public listing cards render, and a role-based ADMIN gate replacing the cookie key. The headline architectural decision is to keep `session.strategy = "jwt"` while adding the Prisma adapter (preserving existing cookies, static SEO pages, and no forced logout), with role/identity resolved **inside the `jwt` callback**. Ownership is an object-level join table (`BusinessOwner`) that is the authorization source of truth, granted only at claim verification with the token delivered to the **business-controlled** email — closing the claim-hijack hole that exists today. Monetization is fully scaffolded but billing-off behind a single env flag for beta. The two highest-risk areas — claim-ownership security and guest-writable POST abuse — are fixed before the features that depend on them ship.

---

## 1. Vision & roles

One `User` table, a `role` enum on the user, object-level ownership in a join table. Roles are **not exclusive** — an ADMIN can own a barn.

- **USER — horse owner (consumer). Free forever (Zillow model).** Google sign-in. Can favorite stables, save searches with email alerts, send inquiries (leads), write reviews. Default role on first sign-in. Never hits a paywall.
- **OWNER — barn owner.** A USER who has a verified `BusinessOwner` link to ≥1 `Business`. Gets a dashboard to edit the fields that fill the public listing cards (`attributes.offering`, `attributes.priceFrom`, `Business.amenities`, photos, hours) and respond to reviews. OWNER is granted at claim verification, never at sign-in.
- **ADMIN — moderator.** Replaces the `ADMIN_KEY` cookie gate in `web/src/lib/auth/admin.ts`. Granted via an `ADMIN_EMAILS` allow-list, resolved inside the JWT callback.

Monetization lives **entirely on the owner side** (`Business.isFeatured`/`featuredUntil`, `verificationBadge`, `Subscription`, `Purchase`). The consumer side never touches billing. During beta a single env flag makes every owner feature free too.

---

## 2. Auth & data-model foundation

### 2.1 `web/src/auth.ts` — adapter without breaking Google sign-in

Keep `strategy: "jwt"` and add `PrismaAdapter`. **All role and identity resolution happens inside the `jwt` callback** — not in `events.signIn`, because with JWT sessions an `events` mutation never flows into the freshly-minted token (a newly allow-listed admin would stay `USER` until a forced refresh). The ADMIN allow-list is therefore folded into the upsert.

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // KEEP jwt — preserves cookies + static SEO
  trustHost: true,
  providers: [Google], // Google ONLY. Resend is a transport, NOT a login provider (see §2.5).
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) { token.uid = user.id; token.role = (user as { role?: UserRole }).role ?? "USER"; }
      // Legacy JWT (no uid) OR forced refresh (just became OWNER): re-read by email.
      if ((!token.uid || trigger === "update") && token.email) {
        const isAdmin = adminEmails.includes(token.email.toLowerCase());
        const u = await prisma.user.upsert({
          where: { email: token.email },
          // Only create the minimum identity. NEVER set tokens/accounts here.
          create: { email: token.email, name: token.name, image: token.picture, ...(isAdmin ? { role: "ADMIN" } : {}) },
          update: isAdmin ? { role: "ADMIN" } : {}, // promote allow-listed admins; never demote here.
          select: { id: true, role: true },
        });
        token.uid = u.id; token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as UserRole) ?? "USER";
      }
      return session;
    },
  },
});
```

**Account-merge hardening (security note, not optional).** The lazy email-keyed upsert exists only to back-fill `User` rows for users holding pre-migration JWTs. Because Google is the **only** login provider, every legacy token is Google-issued, so email-keyed back-fill is safe *today*. If a second provider (e.g. email magic-link) is ever added, this upsert becomes an email-based account-takeover vector ("AccountNotLinked" class) and must be gated on the email already having a Google `Account` row. This is why §2.5 uses Resend strictly as an email **transport** and never adds it to `providers[]`.

- New dep: `@auth/prisma-adapter`.
- New file `web/src/types/next-auth.d.ts` augments `Session.user` and `JWT` with `id` + `role`.
- `web/src/app/api/auth/[...nextauth]/route.ts` is **unchanged**.
- New env: `ADMIN_EMAILS`, `RESEND_API_KEY`. Retire `ADMIN_KEY`.

### 2.2 Prisma diff — Auth.js models + role + ownership

Append to `web/prisma/schema.prisma`. Token columns are `@db.Text` because Google `id_token`s overflow varchar; `User.image` is `@db.Text` because Google image URLs are long.

```prisma
enum UserRole { USER OWNER ADMIN }

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?   @db.Text
  role          UserRole  @default(USER)

  // consumer profile + notification prefs
  phone              String?  @db.VarChar(32)
  city               String?  @db.VarChar(255)
  emailAlertsEnabled Boolean  @default(true)
  inquiryCopyToSelf  Boolean  @default(true)

  accounts          Account[]
  sessions          Session[]
  ownerships        BusinessOwner[]
  claims            ClaimRequest[]
  savedStables      SavedStable[]
  savedSearches     SavedSearch[]
  inquiries         Inquiry[]
  reviews           Review[]
  notifications     Notification[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([role])
}

model Account {
  id String @id @default(cuid())
  userId String
  type String
  provider String
  providerAccountId String
  refresh_token String? @db.Text
  access_token  String? @db.Text
  expires_at Int?
  token_type String?
  scope String?
  id_token String? @db.Text
  session_state String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@index([userId])
}

// Adapter type-completeness; with strategy:"jwt" NO rows are written here.
model Session {
  sessionToken String @id
  userId String
  expires DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model VerificationToken {
  identifier String
  token String @unique
  expires DateTime
  @@unique([identifier, token])
}

// Ownership link — the authorization source of truth (NOT the badge).
model BusinessOwner {
  id String @id @default(cuid())
  userId String
  businessId String
  claimId String? @unique        // provenance: which verified claim granted this
  isPrimary Boolean @default(false)
  createdAt DateTime @default(now())
  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  business Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  claim    ClaimRequest? @relation(fields: [claimId], references: [id], onDelete: SetNull)
  @@unique([userId, businessId])
  @@index([businessId])
  @@index([userId])
}
```

Edits to **existing** models (all additive — new back-relations + nullable columns):
- `Business` (after `claims ClaimRequest[]`, ~L121): add `owners BusinessOwner[]`, `savedBy SavedStable[]`, `inquiries Inquiry[]`, `subscription Subscription?`, `purchases Purchase[]`.
- `ClaimRequest` (L230): add `userId String?` + `user User? @relation(... onDelete: SetNull)`, `tokenExpiresAt DateTime?`, `ownership BusinessOwner?`, `@@index([ownerEmail])`. **`userId` nullable** so the current anonymous email-token path still compiles during migration.
- `Review` (L208): add `userId String?` + `user User? @relation(... onDelete: SetNull)`, `@@index([userId])`. Keep `authorName`/`authorEmail` as write-time snapshots so display survives account deletion.

All additions are new tables + nullable columns → **non-destructive, zero-downtime, no backfill**. Migrate: `cd web && npx prisma migrate dev --name add_auth_and_ownership && npx prisma generate` (prod: `migrate deploy`).

### 2.3 Roles & guards — `web/src/lib/auth/guards.ts` (new)

- `requireUser()` → 401 if no session.
- `requireRole(min)` with rank `USER < OWNER < ADMIN` → 403.
- `requireAdmin()`.
- `requireBusinessOwner(businessId)` — looks up `BusinessOwner` by `{ userId: session.user.id, businessId }` (ADMIN bypasses). **`businessId` always comes from the URL, never the request body** — this is the structural fix for the claim-hijack hole.

Rewrite `web/src/lib/auth/admin.ts` `isAdmin()` to `(await auth())?.user?.role === "ADMIN"` — same signature, existing call sites keep working. Drop `ADMIN_COOKIE`/`adminKey()` (see M2 for the login-page replacement, which has real importers).

### 2.4 Claim → ownership (the security core)

Today `verifyClaim` (`web/src/lib/db/claim.ts:40`) flips `isVerified`/badge but records **nobody as owner**, and `/claim/verify` is an anonymous GET page — anyone with the token URL verifies. The fixes, in dependency order:

1. **Token goes to the business, not the claimant (P0 auth fix).** The "signed-in Google email === `claim.ownerEmail`" check proves nothing, because `ownerEmail` comes from the request body (`claim/route.ts` reads `body.ownerEmail`) — an attacker can claim any business with their own email and pass their own check. Therefore: **the verification link is emailed to `business.email` (the crawled contact address), not to a claimant-chosen address.** When `claim.ownerEmail !== business.email` (or `business.email` is null), the claim is routed to admin review (`admin/disputes`) instead of auto-verifying.
2. **Verification becomes a POST route handler, not a GET page side effect.** Convert verification from the server-component page (`src/app/claim/verify/page.tsx`, which currently calls `verifyClaim` on render) into a new `POST /api/claim/verify` route with a confirm step. The page becomes a thin client form that POSTs the token — GET renders must not mutate state (link-prefetch/CSRF). The route requires a session; anonymous → `signIn("google")` with `callbackUrl` back to the confirm page.
3. **Email binding (second factor) on the verifier.** The session user's Google email must match the address the token was sent to (`business.email`), case-insensitive. Google already proved mailbox control.
4. **Token expiry.** `tokenExpiresAt = sentAt + 72h`; expired → `{ status: "expired" }` + a resend action (`api/claim/resend`).
5. **Grant ownership in-transaction.** On success, inside the existing `$transaction`: `businessOwner.upsert({ userId, businessId, claimId, isPrimary: true })` and `user.updateMany({ where: { id: userId, role: "USER" }, data: { role: "OWNER" } })` (never demote ADMIN). Keep the existing non-downgrade badge rule (`claim.ts:50-54`).
6. **Dispute withholding.** If the business already has a primary owner, the claim is recorded `VERIFIED` but ownership is **withheld** and routed to `admin/disputes`.

`createClaim` + `web/src/app/api/businesses/[id]/claim/route.ts` stamp `userId` (from `auth()` if present) and `tokenExpiresAt`. After a successful verify, the client calls `useSession().update()` so the role refreshes to OWNER without re-login.

### 2.5 Email transport — `web/src/lib/email.ts` (new)

Use the **Resend SDK directly as a transport** (no `Resend` login provider). Functions: `sendClaimVerification(toBusinessEmail, verifyUrl, businessName)` replacing the placeholder in the claim route (which currently returns the raw `verifyUrl`; keep that raw return **only** when `NODE_ENV !== "production"` for tests); `sendOwnerInquiryAlert(...)` and `sendSavedSearchDigest(...)` for §3. Env: `RESEND_API_KEY` + a verified sending domain. New dep: `resend`.

### 2.6 Shared rate limiting & cron auth (cross-cutting prerequisites)

- **Shared limiter.** The current `web/src/middleware.ts` limiter is in-memory per-edge-instance and only matches `/api/search` + `/api/filter`. Guest-writable POSTs (`/inquiry`, `/reviews`) are spam and email-bomb vectors (each inquiry emails `business.email`). Add a shared limiter (Upstash Redis / Vercel KV) in a `web/src/lib/ratelimit.ts` helper and **extend the middleware matcher** to cover `/api/businesses/*/inquiry` and `/api/businesses/*/reviews`. This must land **before M6**. New dep: `@upstash/ratelimit` + `@upstash/redis` (or KV).
- **Cron auth.** No `CRON_SECRET` pattern exists today. Every cron route (`saved-search-alerts`, `featured-expiry`) verifies `Authorization: Bearer ${process.env.CRON_SECRET}` and returns 401 otherwise; wire via Vercel cron config. Define this helper once and reuse.

### 2.7 Shared `StableCard` extraction (refactor prerequisite)

`StableCard` is a non-exported local function inside the `"use client"` file `web/src/components/map/MapView.tsx` (~L43). Owner and account **server components** cannot import it as-is. Extract it to `web/src/components/stable/StableCard.tsx` as a shared component (done in M4, consumed by M5/owner previews). Until then, "reuses StableCard" is not achievable — treat the extraction as a real task, not a given.

---

## 3. Horse-owner (consumer) features & screens

Free forever — no consumer model touches billing. New Prisma models (append, migrated per milestone): `SavedStable`, `SavedSearch` + `AlertFrequency` enum, `Inquiry` + `InquiryStatus` enum, `Notification` + `NotificationType` enum. (`PushSubscription` is deferred to post-beta — see M8c.)

- `SavedStable` is `@@unique([userId, businessId])` (login required, no guest path).
- `SavedSearch` stores `filters Json` + `filtersHash` (dedup/matching) + `lastCheckedAt`.
- `Inquiry.userId` is nullable (guest leads allowed).

**API routes** (App Router; `params` is `Promise`-wrapped per this repo; DB logic in `web/src/lib/db/*` mirroring `claim.ts`; authed routes call `requireUser()`):
- Favorites: `POST/GET /api/saved-stables`, `DELETE /api/saved-stables/[businessId]` → `web/src/lib/db/savedStable.ts`.
- Saved searches: `POST/GET /api/saved-searches`, `PATCH/DELETE /api/saved-searches/[id]` → `web/src/lib/db/savedSearch.ts` (`normalizeFilters`/`hashFilters`). Filters mirror `/api/map` params (`STABLES_SLUG = "horse-boarding"`, `amenities`, bbox, `priceFrom`, rating).
- Inquiry: `POST /api/businesses/[id]/inquiry` (mirrors claim route; auto-fills + sets `userId` when signed in, guest allowed; **shared rate limiter by IP from §2.6**; emails `business.email`; `AuditLog action:"INQUIRY_CREATED"`).
- Reviews: `POST /api/businesses/[id]/reviews` (auth, sets `userId`, `isVerifiedAuthor:true`; recompute `Business.rating`/`reviewCount` in `$transaction`); `GET /api/me/reviews`; `PATCH/DELETE /api/reviews/[id]` (author-only; edits reset `isApproved`).
- Account: `GET/PATCH/DELETE /api/me`. Notifications: `GET /api/notifications`, `POST /api/notifications/read`.
- Alert engine: `web/src/lib/alerts/runSavedSearchAlerts.ts` reuses `STABLES_SLUG`/`PUBLIC_CATEGORY_WHERE` from `web/src/lib/db/business.ts`, matches stables created/updated since `lastCheckedAt`, creates `Notification` + email; triggered by `GET /api/cron/saved-search-alerts` (cron-secret guarded per §2.6). **Cost note:** bbox matching is O(searches × businesses) — it re-runs the geo query per saved search. Fine at beta volume; cap the number of active alerts per user.

**Review moderation policy (decision).** `Review.isApproved` defaults `false` in the schema. To avoid the feature feeling broken in beta, **auto-approve reviews where `isVerifiedAuthor === true`** (signed-in, email-verified author) by setting `isApproved: true` on create; guest/edited reviews stay pending. State this in the `ReviewForm` done-criteria.

**Rating recompute invariant.** `Business.rating`/`reviewCount` must be recomputed in a `$transaction` on review **create, edit (PATCH), delete, and admin approval toggle** — not only on create — or the aggregate drifts.

**Screens** — protected `web/src/app/account/` (layout guards via `auth()` → `signIn("google")`; layout sets `noindex` + forces dynamic rendering so the guard can't be statically leaked), reusing design tokens from `AuthButton.tsx` (`brass`, `pine`, `ink`): `/account` (dashboard), `/account/saved` (shared `StableCard` from §2.7), `/account/searches` (alert toggles + frequency), `/account/inquiries`, `/account/reviews`, `/account/notifications`, `/account/profile`.

**Inline entry points:** `SaveHeartButton` on `StableCard` + `business/[slug]/page.tsx` header (signed-out → `signIn` preserving intent via `callbackUrl` carrying the `businessId`); "Save this search" modal in the map toolbar; `InquiryForm` (modeled on `ClaimForm.tsx`) + `ReviewForm` on the business page; notification bell in `AuthButton.tsx`/`MobileAuthCorner.tsx`; account dropdown gains Saved / Searches / Inquiries / Reviews / Notifications links.

**Zillow-parity additions (folded in):**
- **Saved-state on map pins.** Feed "my saved business ids" back into `/api/map` markers so hearts render filled across the map (a lightweight client-side `GET /api/saved-stables` merge), matching Zillow's saved-home pins.
- **Recently viewed** (client-only localStorage list on the business page) — trivial, high engagement; include a simple `/account` strip.
- **De-dupe note:** guest inquiries have no account record (acceptable for beta); signed-in inquiries show in `/account/inquiries`. No hard per-user inquiry cap beyond the rate limiter for beta — note as a known gap.

---

## 4. Barn-owner backend — what actually fills the listing cards

The revenue-relevant half: the dashboard writes the **same fields the public cards read** — verified at `web/src/app/api/map/route.ts:40,57-59` (`attributes.offering`, `attributes.priceFrom`, `Business.amenities`) and the `StableCard` consumer.

**Authorization & attribute-merge invariant.** Every owner route/page calls `requireBusinessOwner(id)` (businessId from the URL). For any route that merges `Business.attributes` (e.g. the `offering` route), the route must **re-read `attributes` from the DB inside the write transaction and merge server-side** — never trust a client-supplied attribute blob, or an owner could overwrite `googleMapsUri` or, worse, `attributes.addons` (billing state from §5) to grant themselves entitlements. **Strip `addons` and any billing keys from owner-writable merges.**

**API routes** (`web/src/app/api/owner/...`, all owner-guarded):

| Route | Method | Writes |
|---|---|---|
| `owner/businesses` | GET | list owned (dashboard home) |
| `owner/businesses/[id]` | PATCH | `name, description, phone, email, website, address, socialLinks` |
| `owner/businesses/[id]/offering` | PATCH | server-side merge `{...dbAttributes, offering, priceFrom}` (preserves `googleMapsUri`, strips `addons`) |
| `owner/businesses/[id]/amenities` | PUT | replace `Business.amenities[]` |
| `owner/businesses/[id]/hours` | PUT | `hoursOfOperation` Json (`weekdayDescriptions` shape the detail page reads) |
| `owner/businesses/[id]/images` | POST/DELETE/PATCH | `BusinessImage{ source:"OWNER" }`, reorder `rank` (see blob upload below) |
| `owner/businesses/[id]/reviews/[rid]/respond` | POST | `Review.ownerResponse` + `ownerRespondedAt`, recompute `responseRate` |
| `owner/businesses/[id]/transfer` | POST | OWNER-only invite/relinquish |
| `admin/disputes` | GET/POST | resolve competing claims |

**Owner photo upload (explicit sub-task — undeliverable otherwise).** `@vercel/blob` is **not** currently a dependency. Add: the `@vercel/blob` dep, a presigned/client-upload token handler on the images route, MIME + size validation, and `BLOB_READ_WRITE_TOKEN` env. Without this, the "owner photos appear on cards" criterion cannot ship.

**Card-write semantics:** `offering` is constrained to a shared `const OFFERINGS = ["Stalls Available","Summer Camp","Lessons","Training"]` (matching the map default); `priceFrom` is a validated positive number. **Owner-photo override:** change the image ordering in `businessDetailInclude` (`web/src/lib/db/business.ts:40`, currently `orderBy: { rank: "asc" }`) to `orderBy: [{ source: ... }, { rank: "asc" }]` so OWNER images sort ahead of GOOGLE/CRAWLER rows without deleting crawled data.

**`responseRate` formula (defined):** `responseRate = respondedReviewCount / totalReviewCount * 100`, stored in the existing `Decimal(5,2)` column, recomputed in the respond transaction. (Numerator = reviews with non-null `ownerResponse`; denominator = total reviews for the business.)

**Screens** — `web/src/app/owner/` server components, `requireBusinessOwner` at the page boundary (wrong owner → `notFound()`); `owner/layout.tsx` → `signIn` if no session, "Claim your barn" CTA if no ownerships; layout sets `noindex` + dynamic rendering: `/owner` (home, response-backlog count), `/owner/[slug]` (live `StableCard` preview), `/owner/[slug]/details`, `/owner/[slug]/listing` (offering segmented control + price + amenities grid with inline card preview — **the card-driving screen**), `/owner/[slug]/photos` (drag-reorder, set cover, shows overridden Google photos), `/owner/[slug]/hours`, `/owner/[slug]/reviews` (reply box + inquiry inbox tab), `/owner/[slug]/team` (OWNER-only). `AuthButton.tsx` dropdown gains "Barn dashboard" when `role === "OWNER"`.

---

## 5. Monetization hooks (build now, billing OFF for beta)

**Single flag, one place:** `web/src/lib/billing/beta.ts` — `BILLING_ENABLED = process.env.BILLING_ENABLED === "true"`; `BETA_FREE_EVERYTHING = !BILLING_ENABLED` (defaults true; zero Stripe keys needed to run).

**Entitlement resolver** `web/src/lib/billing/entitlements.ts` — `entitlementsFor(sub, attrs)` returns full PRO + all add-ons when `BETA_FREE_EVERYTHING`. Every gate (owner-photo upload, analytics panel, microsite) calls this one function. The **stub returning full-Pro in beta ships in M4** (the owner-photo upload gate depends on it), with the real tier logic filled in at M9. Tiers map 1:1 to real fields: owner-photo upload (Pro-gated insert of `BusinessImage source:OWNER`), `verificationBadge` ceiling (FREE→VERIFIED, PRO→TRUSTED, microsite→PREMIUM), priority placement (existing `ORDER BY isFeatured DESC` in `db/business.ts`/`db/search.ts` — **no change needed**), analytics.

**New models** (additive, idle until billing on): `Subscription` (`@@unique businessId`, `stripeCustomerId/SubscriptionId`, `currentPeriodEnd`, `SubTier`/`SubStatus` enums), `Purchase` (one-off add-on ledger, `expiresAt` mirrors `featuredUntil`). Add-on **state** lives in the nullable `Business.attributes.addons` JSON — **no migration for add-on state** — and is writable only by the Stripe webhook (owner routes strip it per §4).

**Stripe scaffolding, inert in beta:** `web/src/lib/billing/stripe.ts` — `stripe` is `null` unless `BILLING_ENABLED && STRIPE_SECRET_KEY` (test-mode `sk_test_` only). Routes `api/billing/{checkout,portal,webhook}/route.ts` exist; first line `if (!stripe) return 503`. The webhook is the **only** writer of paid state, reconciling into `Subscription` + `verificationBadge` (reusing the non-downgrade rule from `claim.ts:50-54`) + `isFeatured`/`featuredUntil` + `attributes.addons`. A `featuredUntil` expiry cron (`api/cron/featured-expiry`, cron-secret guarded) flips `isFeatured=false` when expired. Flip on: set `BILLING_ENABLED=true` + Stripe envs; nothing else changes. New dep: `stripe`.

Consumer/claim side stays free throughout — nothing in §5 touches `ClaimRequest`, `SavedStable`, `Inquiry`, or `Review`.

---

## 6. Build sequence — independently-shippable milestones, dependency order

### M1 — Persistence foundation (unblocks everything)
Add `@auth/prisma-adapter`; add `User`/`Account`/`Session`/`VerificationToken`/`UserRole`/`BusinessOwner`; add back-relations + `userId`/`tokenExpiresAt` on `ClaimRequest`, `userId` on `Review`, `owners` on `Business`. Wire `auth.ts` (adapter, JWT-callback role/identity resolution **with ADMIN allow-list folded into the upsert — no `events.signIn`**, lazy email back-fill with the Google-only safety note from §2.1) keeping `strategy:"jwt"`. Add `web/src/types/next-auth.d.ts`, `web/src/lib/auth/guards.ts`. Migrate `add_auth_and_ownership`.
- **Touches:** `prisma/schema.prisma`, `src/auth.ts`, `src/types/next-auth.d.ts`, `src/lib/auth/guards.ts`, `package.json`.
- **Done when:** an existing Google user signs in, gets a `User` row (verify in DB), `session.user.id` + `role` are populated, an allow-listed email resolves to `role:ADMIN` **on the first request without a forced refresh**, no one is logged out, and `/business/[slug]` + `/api/map` still render statically.

### M2 — Email transport + admin migration
Add `resend` dep; `web/src/lib/email.ts` (`sendClaimVerification` transport, no login provider). Rewrite `isAdmin()` to role-based. **Replace `/admin/login`** — it is a real page importing `ADMIN_COOKIE`/`adminKey` and setting the cookie, and `admin/review` `redirect("/admin/login")` points at it; swap the login page for a "Sign in with Google" page (or repoint the redirect) so allow-listed admins have somewhere to land. Then remove `ADMIN_KEY`/`ADMIN_COOKIE`/`adminKey()`.
- **Touches:** `src/lib/email.ts`, `src/lib/auth/admin.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/review/*` (redirect target), env, `package.json`.
- **Done when:** a claim email actually sends via Resend; an allow-listed admin can reach `/admin/review` via Google sign-in; the `ADMIN_KEY` env and cookie path are gone with no dead importers.

### M3 — Claim → ownership (security core)
Rework `createClaim`/`verifyClaim` (`src/lib/db/claim.ts`): **send token to `business.email`** (route mismatched-email claims to disputes), session-required verify, email-bound, 72h expiry, grant `BusinessOwner` + promote to OWNER in-transaction, dispute withholding. **Convert verification from the GET page to `POST /api/claim/verify`** + a thin client confirm form replacing the side-effecting render in `src/app/claim/verify/page.tsx`. Add `api/claim/resend`, `api/admin/disputes`.
- **Touches:** `src/lib/db/claim.ts`, `src/app/api/businesses/[id]/claim/route.ts`, `src/app/claim/verify/page.tsx` (→ client form), `src/app/api/claim/verify/route.ts` (new), `src/app/api/claim/resend/route.ts`, `src/app/api/admin/disputes/route.ts`.
- **Done when:** a claim emails the link to `business.email`; verifying while signed in as that matching mailbox creates a `BusinessOwner` row + sets `role=OWNER` via `update()` with no re-login; a token leaked to a non-matching email is rejected; a claimant-chosen `ownerEmail` that differs from `business.email` goes to admin review; expired tokens offer resend; a second claim on an owned business goes to disputes; verification is a POST (GET no longer mutates).

### M4 — Owner dashboard (fills the cards)
Use `requireBusinessOwner` from guards. **Extract `StableCard`** to `src/components/stable/StableCard.tsx` (§2.7). Add `entitlementsFor` **stub** (full-Pro in beta) so the photo gate works. Add `@vercel/blob` + presigned upload handler + MIME/size guard. Build `api/owner/*` routes (server-side attribute merge stripping `addons`); change image ordering in `businessDetailInclude` to source-priority; `OFFERINGS` const; define `responseRate` formula; `web/src/app/owner/**` screens; "Barn dashboard" link in `AuthButton.tsx`.
- **Touches:** `src/components/stable/StableCard.tsx` (new), `src/components/map/MapView.tsx` (import shared card), `src/lib/billing/{beta,entitlements}.ts` (stub), `src/app/api/owner/**`, `src/lib/db/business.ts`, `src/app/owner/**`, `src/components/auth/AuthButton.tsx`, `package.json`.
- **Done when:** an owner edits offering/price/amenities and the change appears on the public `StableCard` via `/api/map`; an owner uploads a photo (blob) that overrides Google ordering on the detail page; owner replies to a review and `responseRate` updates by the defined formula; non-owners get `notFound()`; the merge cannot alter `googleMapsUri` or `addons`.

### M5 — Consumer favorites
`SavedStable` model (migrate), `api/saved-stables` routes, `web/src/lib/db/savedStable.ts`, `SaveHeartButton` (signed-out path round-trips `businessId` through `callbackUrl`), `/account` + `/account/saved` (shared `StableCard`), saved-id merge into `/api/map` markers, `account/` layout `noindex` + dynamic.
- **Touches:** `prisma/schema.prisma`, `src/app/api/saved-stables/**`, `src/lib/db/savedStable.ts`, `src/components/saved/SaveHeartButton.tsx`, `src/app/account/**`, map-marker client merge.
- **Done when:** a signed-in user hearts a stable from a card and it persists + shows in `/account/saved`; a **signed-out heart triggers `signIn`, and after login the save completes for the originally clicked business** (intent round-trip tested); map pins show filled hearts for saved stables.

### M6 — Consumer inquiries (highest lead value)
**Prereq: shared rate limiter (§2.6) + extended middleware matcher must land first.** `Inquiry` model + `InquiryStatus` (migrate), `POST /api/businesses/[id]/inquiry`, `web/src/lib/db/inquiry.ts`, `InquiryForm`, `/account/inquiries`, owner inbox tab in `/owner/[slug]/reviews`.
- **Touches:** `src/lib/ratelimit.ts` (new), `src/middleware.ts` (matcher), `prisma/schema.prisma`, `src/app/api/businesses/[id]/inquiry/route.ts`, `src/lib/db/inquiry.ts`, `src/components/inquiry/InquiryForm.tsx`, `src/app/account/inquiries/**`, `package.json`.
- **Done when:** a guest and a signed-in user can both submit a lead; the barn receives an email at `business.email`; the signed-in user sees it in `/account/inquiries`; the rate limiter rejects burst spam on `/inquiry` (verified shared across instances, not just per-instance memory).

### M7 — Consumer reviews
`Review.userId` already added in M1. Build `POST /api/businesses/[id]/reviews` (auto-approve when `isVerifiedAuthor`), `GET /api/me/reviews`, `PATCH/DELETE /api/reviews/[id]`, `ReviewForm`, `/account/reviews`. Recompute rating in `$transaction` on create/edit/delete/approval. Reuse the shared rate limiter on the public POST.
- **Touches:** `src/app/api/businesses/[id]/reviews/route.ts`, `src/app/api/reviews/[id]/route.ts`, `src/lib/db/review.ts`, `src/components/reviews/ReviewForm.tsx`, `src/app/account/reviews/**`.
- **Done when:** a signed-in user posts a review (`isVerifiedAuthor:true`, auto-approved, immediately visible), `Business.rating`/`reviewCount` update atomically on every mutation path, and the owner can respond (M4 route).

### M8a — Saved searches + email alerts
`SavedSearch` + `AlertFrequency` (migrate), `api/saved-searches` routes, `normalizeFilters`/`hashFilters`, `runSavedSearchAlerts.ts`, `api/cron/saved-search-alerts` (cron-secret guarded), save-search modal, `/account/searches`.
- **Touches:** `prisma/schema.prisma`, `src/lib/db/savedSearch.ts`, `src/lib/alerts/runSavedSearchAlerts.ts`, `src/app/api/saved-searches/**`, `src/app/api/cron/saved-search-alerts/route.ts`, `src/app/account/searches/**`, `src/lib/cron-auth.ts`.
- **Done when:** saving a search then publishing a matching stable produces a `Notification` + email within the frequency window; the cron route 401s without the bearer secret; active-alert count is capped per user.

### M8b — In-app notifications + bell
`Notification` + `NotificationType` (migrate), `api/notifications` routes, `/account/notifications`, bell badge in `AuthButton.tsx`/`MobileAuthCorner.tsx`.
- **Touches:** `prisma/schema.prisma`, `src/app/api/notifications/**`, `src/app/account/notifications/**`, `src/components/auth/*`.
- **Done when:** the bell shows an unread count and notifications mark-read.

### M8c — Web push (POST-BETA, deferred)
`PushSubscription` model, VAPID keys, service worker, `api/push/(un)subscribe`. Zero beta value (Zillow leads with email), high cost — explicitly out of the beta cut.

### M9 — Monetization (billing OFF)
Flesh out `entitlements.ts` real tier logic (stub from M4), add `web/src/lib/billing/stripe.ts`, `Subscription`/`Purchase` models + enums (migrate), `api/billing/{checkout,portal,webhook}/route.ts` (inert, 503 when `!stripe`), `featuredUntil` expiry cron. Webhook is the sole writer of paid state.
- **Touches:** `prisma/schema.prisma`, `src/lib/billing/**`, `src/app/api/billing/**`, `src/app/api/cron/featured-expiry/route.ts`, `package.json`.
- **Done when:** with `BILLING_ENABLED` unset, every owner gets full Pro (uploads/analytics/add-ons on) and `api/billing/*` return 503; setting `BILLING_ENABLED=true` + Stripe test keys makes the webhook reconcile a test subscription into `Subscription` + badge + `isFeatured` with no other code change.

**Critical path:** M1 → M2 → M3 → M4 (owner revenue surface). The consumer track (M5–M8b) depends only on M1 and can run in parallel after M1, except M6 also requires the §2.6 rate limiter and M5/M6 require the `StableCard` extraction from M4. M9 depends on M4 (entitlements stub, owner-photo gate, badge writes). The §2.6 shared limiter + cron auth and the §2.7 card extraction are cross-cutting prerequisites — schedule them at the front of their first consumer.

**Key files (all verified):** `web/prisma/schema.prisma` (Business L76, Review L208, ClaimRequest L230), `web/src/auth.ts`, `web/src/lib/db/claim.ts:40`, `web/src/lib/db/business.ts` (`STABLES_SLUG="horse-boarding"`, `PUBLIC_CATEGORY_WHERE`, `businessDetailInclude:40`), `web/src/app/api/map/route.ts:40,57-59`, `web/src/components/map/MapView.tsx` (`StableCard` L43, **not exported**), `web/src/components/auth/{AuthButton,MobileAuthCorner}.tsx`, `web/src/app/admin/login/page.tsx` (real importer of `ADMIN_COOKIE`/`adminKey`), `web/src/app/claim/verify/page.tsx` (GET side-effect to convert), `web/src/app/api/businesses/[id]/claim/route.ts`, `web/src/middleware.ts` (limiter covers only `/api/search` + `/api/filter`), `web/src/lib/auth/admin.ts`.
