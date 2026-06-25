# Keyword Targets — Programmatic Intent Pages (T18b)

> Drives which `category × city` intent pages (T19) we pre-render at build time
> (`generateStaticParams`); the long tail renders on-demand via ISR. Priority =
> search demand × commercial intent × our data density. Refine with ahrefs/GSC
> data once live (the build-workflow "Keyword Research" step).

## Priority categories (highest commercial intent first)
1. `horse-boarding` — "horse boarding near me", "[city] horse boarding", "barns near me"
2. `trainer-instructor` — "horse trainers [city]", "riding lessons [city]"
3. `equine-veterinarian` — "equine vet [city]", "horse vet near me"
4. `farrier` — "farrier [city]", "horseshoer near me"
5. `tack-shop` — "tack store [city]", "horse tack near me"
6. `feed-forage` — "horse feed store [city]", "hay for sale [city]"
7. `horse-hauling` — "horse transport [city]", "horse hauling near me"

## Priority cities (data-dense equine hubs)
Ocala, Wellington, Tampa, Sarasota, Gainesville, Ocoee/Orlando, Brooksville,
Jacksonville, Naples, Lakeland, Clermont, Bradenton.

## Pre-render set
Top **7 categories × top 12 cities** intent pages are eligible for static
pre-render *when they contain ≥1 listing* (empty combos stay ISR + noindex via
the T18a gate). Everything else is ISR on first request.

## Head terms (hub pages, already shipped)
- "[category] in Florida" (category hubs)
- "equine businesses in [city/county], FL" (location hubs)
