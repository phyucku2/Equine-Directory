import { NextResponse, type NextRequest } from "next/server";
import { isTenantHost } from "@/lib/sites/tenant";

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

// Header used to hand the resolved tenant host from edge middleware to the
// Node-runtime app (where Prisma resolves it via resolveSiteByHost). Edge can't
// hit the DB, so we only flag the host here and resolve downstream.
const TENANT_HOST_HEADER = "x-tenant-host";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Tenant detection (Website Builder): is this request for a barn site (custom
  // domain or *.thestabledirectory.com subdomain) rather than the main app?
  // DB-free + synchronous so it is edge-safe. We flag it via a request header;
  // the actual Site lookup runs server-side in the tenant route group.
  const host =
    request.headers.get("host") ?? request.nextUrl.host ?? "";
  const tenant = host ? isTenantHost(host) : false;

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

  // For tenant hosts, forward the host on a request header so the Node-runtime
  // tenant route group can resolve the Site without re-reading the Host header.
  // Non-tenant (main app) requests pass through untouched.
  if (tenant) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(TENANT_HOST_HEADER, host);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml)$).*)"],
};
