import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health/db — read-only connection diagnostic. Reports ONLY booleans /
// non-secret values about the live DB connection so we can confirm whether prod
// is on Neon's pooled (-pooler / PgBouncer) endpoint without exposing the
// Sensitive DATABASE_URL. Never returns the URL, host, user, or password.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const raw = process.env.DATABASE_URL ?? "";
  let pooled = false;
  let pgbouncer = false;
  let connectionLimit: string | null = null;
  try {
    const u = new URL(raw);
    pooled = u.hostname.includes("-pooler");
    pgbouncer = u.searchParams.get("pgbouncer") === "true";
    connectionLimit = u.searchParams.get("connection_limit");
  } catch {
    // DATABASE_URL missing/unparseable — leave defaults.
  }

  let canConnect = false;
  let latencyMs: number | null = null;
  const start = process.hrtime.bigint();
  try {
    await prisma.$queryRaw`SELECT 1`;
    canConnect = true;
    latencyMs = Number(process.hrtime.bigint() - start) / 1e6;
  } catch {
    canConnect = false;
  }

  // Always 200 (even on DB failure) so this endpoint never itself emits a 5xx.
  return NextResponse.json(
    { ok: canConnect, pooled, pgbouncer, connectionLimit, latencyMs },
    { headers: { "cache-control": "no-store" } },
  );
}
