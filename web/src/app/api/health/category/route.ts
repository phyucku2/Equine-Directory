import { NextResponse } from "next/server";
import { getByCategory, countByCategory } from "@/lib/db/business";
import { getStatesForCategory } from "@/lib/db/intent";
import { getCategoryBySlug } from "@/lib/db/category";

// TEMPORARY diagnostic: /api/health/category?slug=<slug> runs each query the
// /categories/[category] hub depends on, in isolation, and reports which one
// throws (with the error message) — so we can pin down the deterministic 500 on
// that route without Vercel log access. Returns error messages only (no
// secrets); remove once the hub is fixed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? "horse-boarding";
  const out: Record<string, unknown> = { slug };

  const steps: [string, () => Promise<unknown>][] = [
    ["getCategoryBySlug", () => getCategoryBySlug(slug)],
    ["countByCategory", () => countByCategory(slug)],
    ["getByCategory", () => getByCategory(slug, 1)],
    ["getStatesForCategory", () => getStatesForCategory(slug)],
  ];

  for (const [name, fn] of steps) {
    try {
      const r = await fn();
      const size = Array.isArray(r)
        ? r.length
        : r && typeof r === "object" && "items" in r
          ? (r as { items: unknown[] }).items.length
          : typeof r === "object"
            ? "obj"
            : r;
      out[name] = { ok: true, size };
    } catch (e) {
      out[name] = {
        ok: false,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      };
    }
  }

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
