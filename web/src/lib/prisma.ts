import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// database connections. See https://pris.ly/d/help/next-js-best-practices
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Serverless + Postgres connection discipline. On Vercel each concurrent
// function instance gets its own PrismaClient with its own pool; Prisma's
// default pool size (num_cpus*2+1 ≈ 5–9) times many instances under crawl load
// blows past Neon's connection cap, and new invocations then fail to connect
// with PrismaClientInitializationError → 500 (the "Server error (5xx)" mass in
// Search Console). Cap each instance to a single connection and let requests
// queue briefly instead of erroring. connection_limit=1 is Prisma's documented
// serverless recommendation; the durable complement is pointing DATABASE_URL at
// Neon's pooled (-pooler / PgBouncer) endpoint, detected below.
function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const p = u.searchParams;
    const pooled = u.hostname.includes("-pooler");
    // Two very different regimes:
    //  • Pooled (Neon -pooler / PgBouncer): the pooler fans thousands of client
    //    connections into a small server pool, so a per-instance limit of 1 is
    //    needlessly strict — it SERIALIZES a page's Promise.all() queries and
    //    makes concurrent requests on a warm instance queue until pool_timeout,
    //    which then overruns Vercel's function limit and surfaces as a 5xx to
    //    Googlebot (the mass "Server error (5xx)" in Search Console). Allow a
    //    handful of connections so parallel queries actually parallelize, and
    //    fail fast (short pool_timeout) so a blip becomes a quick error the
    //    request/ISR can recover from rather than a hung 5xx.
    //  • Direct endpoint (no pooler): keep the conservative serverless default
    //    of 1 so many function instances don't blow Neon's raw connection cap.
    if (!p.has("connection_limit")) p.set("connection_limit", pooled ? "5" : "1");
    if (!p.has("pool_timeout")) p.set("pool_timeout", pooled ? "10" : "20");
    if (!p.has("connect_timeout")) p.set("connect_timeout", pooled ? "10" : "15");
    // PgBouncer runs in transaction mode — Prisma must disable prepared statements.
    if (pooled && !p.has("pgbouncer")) p.set("pgbouncer", "true");
    return u.toString();
  } catch {
    return raw; // non-URL (shouldn't happen) — leave as-is
  }
}

const datasourceUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
