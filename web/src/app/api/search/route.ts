import { NextResponse } from "next/server";
import { searchBusinesses } from "@/lib/db/search";

// GET /api/search?q=&category=&city=&county=&minRating=&verified=&page=
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await searchBusinesses({
    q: searchParams.get("q") ?? undefined,
    categorySlug: searchParams.get("category") ?? undefined,
    citySlug: searchParams.get("city") ?? undefined,
    countySlug: searchParams.get("county") ?? undefined,
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined,
    verifiedOnly: searchParams.get("verified") === "1",
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
