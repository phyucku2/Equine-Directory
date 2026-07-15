// Proxy for Google Places photos. The crawler stores a photo *reference*
// (resource name); this route fetches the actual image server-side using the
// server Places key (GOOGLE_MAPS_API_KEY) so the key never reaches the browser,
// and caches the bytes. Google requires attribution — shown on the card/detail.

// Only allow well-formed Places photo resource names: places/<id>/photos/<token>
const REF_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref") ?? "";
  const w = Math.min(Math.max(Number(searchParams.get("w")) || 800, 200), 1600);

  if (!REF_RE.test(ref)) {
    return new Response("bad ref", { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    // Not a server fault: with no Places key the proxy is intentionally off
    // (the gosom-sourced catalog stores no Places photos). Old crawler-era
    // photo URLs are still indexed by bots — answer 404 and let the edge
    // cache it so they stop counting as 5xx anomalies.
    return new Response("photos not available", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  const upstream = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&key=${key}`;
  const res = await fetch(upstream, { cache: "force-cache" });
  if (!res.ok || !res.body) {
    // Google refusing the ref (expired/invalid — common for stale indexed
    // URLs) is the requester's 404, cached to stop repeat fetches from
    // burning quota; only a genuine Google 5xx surfaces as 502.
    if (res.status < 500) {
      return new Response("photo not found", {
        status: 404,
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
      });
    }
    return new Response("upstream error", { status: 502 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      // Cache hard at the edge; photo bytes for a given ref are stable.
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
    },
  });
}
