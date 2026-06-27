import { NextResponse, type NextRequest } from "next/server";

// Best-effort in-memory rate limiter for API search/filter. Per-instance only
// (edge instances don't share memory) — a coarse abuse guard, not a hard limit.
// Swap for Upstash/Vercel KV when traffic warrants.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Canonicalize: all slugs are lowercase. 301 mixed-case paths to lowercase.
  if (pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 301);
  }

  // Rate-limit the search/filter APIs and the guest-writable POSTs
  // (/api/businesses/:id/inquiry, /api/businesses/:id/reviews) which are spam
  // and email-bomb vectors. The shared cross-instance limiter (src/lib/ratelimit.ts)
  // runs inside those route handlers; this is the coarse first-pass guard.
  const isWritablePost = /^\/api\/businesses\/[^/]+\/(inquiry|reviews)$/.test(pathname);
  if (
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/filter") ||
    isWritablePost
  ) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (rateLimited(ip)) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    }
  }

  // Strip a stray trailing slash (except root) to the canonical no-slash form.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "");
    return NextResponse.redirect(`${url.pathname}${search}`, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml)$).*)"],
};
