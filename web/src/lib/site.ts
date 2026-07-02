// Central brand/site config. Change the name in one place (or override via env).
// Name is still being finalized — kept configurable on purpose.

export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "The Stable Directory",
  shortName: process.env.NEXT_PUBLIC_SITE_SHORT_NAME ?? "The Stable Directory",
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "thestabledirectory.com",
  description:
    "Find horse stables and barns near you — boarding, training, and facilities nationwide, all in one place.",
} as const;
