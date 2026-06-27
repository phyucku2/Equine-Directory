// Single billing flag, one place. Billing is OFF for beta: with BILLING_ENABLED
// unset (or not "true"), BETA_FREE_EVERYTHING is true and every owner feature is
// free — zero Stripe keys are required to run the app.
export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

export const BETA_FREE_EVERYTHING = !BILLING_ENABLED;
