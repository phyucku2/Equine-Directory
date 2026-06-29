import type { TrainerInput } from "@/lib/db/owner";

// Shared trainer-body validation for the trainers collection + item routes. Lives
// in an underscore-prefixed file so the App Router never treats it as a route.

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function nullableStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

export function parseTrainer(
  body: Record<string, unknown>,
): { ok: true; data: TrainerInput } | { ok: false; error: string } {
  const name = str(body.name, 255);
  if (!name) return { ok: false, error: "A trainer name is required." };
  const email = nullableStr(body.email, 255);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  return {
    ok: true,
    data: {
      name,
      bio: nullableStr(body.bio, 5000),
      photoUrl: nullableStr(body.photoUrl, 1024),
      disciplines: arr(body.disciplines),
      certifications: arr(body.certifications),
      email,
      phone: nullableStr(body.phone, 32),
    },
  };
}
