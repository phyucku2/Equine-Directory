import type { EventInput } from "@/lib/db/owner";
import { PROGRAM_TYPE_SLUGS } from "@/lib/facets";

// Shared event-body validation for the events collection + item routes. Lives in
// an underscore-prefixed file so the App Router never treats it as a route.

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function nullableStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function toDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toCents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// Validate the shared event body. type must be a program-type vocab slug; title +
// a valid startDate are required; endDate (if present) must be >= startDate.
export function parseEvent(
  body: Record<string, unknown>,
): { ok: true; data: EventInput } | { ok: false; error: string } {
  const type = str(body.type, 64);
  if (!PROGRAM_TYPE_SLUGS.has(type)) return { ok: false, error: "Pick a valid event type." };
  const title = str(body.title, 255);
  if (!title) return { ok: false, error: "An event title is required." };
  const startDate = toDate(body.startDate);
  if (!startDate) return { ok: false, error: "A valid start date is required." };
  const endDate = toDate(body.endDate);
  if (endDate && endDate < startDate) {
    return { ok: false, error: "The end date can't be before the start date." };
  }
  const registrationUrl = nullableStr(body.registrationUrl, 512);
  if (registrationUrl && !/^https?:\/\//i.test(registrationUrl)) {
    return { ok: false, error: "Registration URL must start with http:// or https://" };
  }
  return {
    ok: true,
    data: {
      type,
      title,
      description: nullableStr(body.description, 20000),
      startDate,
      endDate,
      price: toCents(body.price),
      registrationUrl,
      imageUrl: nullableStr(body.imageUrl, 1024),
      isPublished: body.isPublished !== false,
    },
  };
}
