// /ads.txt — required by AdSense to authorize Google as a seller of this
// site's inventory. Served only once NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-…)
// is configured; 404 until then. f08c47fec0942fa0 is Google's fixed
// certification-authority ID for AdSense (the same for every publisher).
//
// Deliberately dynamic (runtime) rather than prerendered: a build-time 404
// Response from a force-static route handler is exactly the kind of edge
// Vercel's prerenderer can choke on, and this file is hit too rarely for
// static to matter.
export const dynamic = "force-dynamic";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return new Response("Not configured", { status: 404 });
  const pub = client.replace(/^ca-/, "");
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain" },
  });
}
