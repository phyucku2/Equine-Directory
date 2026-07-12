// Wake the (possibly auto-suspended) Neon database before `next build` prerenders
// the DB-backed pages (/events, /data, /categories, home, …).
//
// Why this exists: Vercel's `vercel-build` runs `prisma generate && next build`.
// `prisma generate` never opens a connection, so `next build` is the FIRST thing
// to touch the database — and on Neon's free tier the compute auto-suspends after
// inactivity. A cold endpoint refuses/limits that first burst of build-time
// connections, so prerendering throws `PrismaClientInitializationError: Can't
// reach database server` and the whole deploy fails. (CI passes because it runs
// `prisma migrate deploy` first, which wakes the DB before building.)
//
// A few retrying pings resume the compute (Neon wakes on connect within a few
// seconds). This script is BEST-EFFORT and always exits 0: it must never be the
// reason a build fails — `next build` remains the real gate. If the DB is truly
// unreachable, we let the build proceed so the genuine error surfaces there.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ATTEMPTS = 6;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (let i = 1; i <= ATTEMPTS; i++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log(`warm-db: database awake (attempt ${i}/${ATTEMPTS})`);
        return;
      } catch (err) {
        const msg = (err && err.message ? err.message : String(err)).split("\n")[0].slice(0, 120);
        console.log(`warm-db: attempt ${i}/${ATTEMPTS} failed — ${msg}`);
        if (i < ATTEMPTS) await sleep(2000 * i); // 2s, 4s, 6s, 8s, 10s backoff
      }
    }
    console.log("warm-db: could not confirm the database after retries; continuing to build anyway.");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

try {
  await main();
} catch (err) {
  const msg = (err && err.message ? err.message : String(err)).split("\n")[0].slice(0, 120);
  console.log(`warm-db: skipped (${msg}); continuing to build.`);
}
