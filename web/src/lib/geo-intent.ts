// "near me" search-intent parsing. When a visitor types "horseback riding near
// me" into the search box, the phrase "near me" is intent, not a keyword — it
// must pivot the search to geolocation, not full-text match the literal words.
// This splits the query into { nearMe, residual }: residual is the service the
// visitor actually wants ("horseback riding"), which the caller resolves to a
// category and sorts by distance. Pure + client-safe (no imports) so the search
// page, the API route, and the client island can all share one definition.

// Standalone geo cues ("nearby", "closest") and "<preposition> me/us/my area"
// forms. Kept deliberately tight so a barn literally named "Nearby Farm" or
// "Close Call Stables" isn't swallowed — the pronoun anchor does the work.
const NEAR_ME_PATTERN =
  "\\b(?:near\\s*by|nearby|near(?:est)?\\s+(?:me|us|my\\b)|around\\s+(?:me|us)|" +
  "close\\s+(?:to\\s+me|by)|in\\s+my\\s+area|closest\\s+(?:to\\s+me)?|closest|nearest)\\b";

export interface NearMeQuery {
  /** True when the query expresses "near me"-style proximity intent. */
  nearMe: boolean;
  /** The query with the proximity phrase removed (the service to search for). */
  residual: string;
}

export function parseNearMe(q: string | undefined | null): NearMeQuery {
  const text = (q ?? "").trim();
  if (!text) return { nearMe: false, residual: "" };
  // Fresh RegExp per call — a module-level /g regex carries lastIndex between
  // calls and would intermittently miss matches.
  if (!new RegExp(NEAR_ME_PATTERN, "i").test(text)) {
    return { nearMe: false, residual: text };
  }
  const residual = text
    .replace(new RegExp(NEAR_ME_PATTERN, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
  return { nearMe: true, residual };
}
