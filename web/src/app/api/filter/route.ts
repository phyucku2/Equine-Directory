import { NextResponse } from "next/server";
import { searchBusinesses, getCategoryFacets, type SearchParams } from "@/lib/db/search";

// POST /api/filter — faceted browse. Body: SearchParams. Returns results + facets.
export async function POST(request: Request) {
  let body: SearchParams = {};
  try {
    body = (await request.json()) as SearchParams;
  } catch {
    // empty body is fine
  }

  const params: SearchParams = {
    q: body.q,
    categorySlug: body.categorySlug,
    citySlug: body.citySlug,
    countySlug: body.countySlug,
    minRating: body.minRating ? Number(body.minRating) : undefined,
    verifiedOnly: Boolean(body.verifiedOnly),
    page: body.page ? Number(body.page) : 1,
  };

  const [results, categoryFacets] = await Promise.all([
    searchBusinesses(params),
    getCategoryFacets(params),
  ]);

  return NextResponse.json(
    { ...results, facets: { categories: categoryFacets } },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
