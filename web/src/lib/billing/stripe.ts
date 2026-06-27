import Stripe from "stripe";
import { BILLING_ENABLED } from "./beta";

// Stripe client, inert in beta. `stripe` is `null` unless billing is explicitly
// enabled AND a TEST-MODE secret key is present. Every billing route's first line
// is `if (!stripe) return 503`, so with billing off (the beta default) no Stripe
// configuration is required and the whole surface is dormant.
//
// Guard rails for beta safety:
//  - billing must be enabled (`BILLING_ENABLED`),
//  - the key must be a TEST key (`sk_test_`) — we refuse live keys during beta so
//    a stray live secret can never charge a real card from this build.

const secretKey = process.env.STRIPE_SECRET_KEY;

const isTestKey = typeof secretKey === "string" && secretKey.startsWith("sk_test_");

export const stripe: Stripe | null =
  BILLING_ENABLED && isTestKey
    ? new Stripe(secretKey as string, {
        // Pin omitted: use the SDK's bundled API version so types stay aligned.
        typescript: true,
        appInfo: { name: "equine-directory" },
      })
    : null;

// The webhook signing secret, used to verify Stripe-Signature on the webhook.
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
