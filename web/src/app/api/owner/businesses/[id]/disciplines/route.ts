import { NextResponse } from "next/server";
import { withOwner } from "@/lib/auth/owner-route";
import { requireEntitlement } from "@/lib/auth/owner-entitlement";
import { updateDisciplines } from "@/lib/db/owner";

export const dynamic = "force-dynamic";

// PUT /api/owner/businesses/[id]/disciplines — Disciplines & Training tab.
// Writes disciplines accepted, trainingTypes, trainingDisciplines, lessonLevels
// (all validated against vocab), plus the open/closed-barn trainer policy. Only
// the trainer-policy slugs of `policies` are touched here; the Facility tab owns
// the rest and they are preserved server-side. Touched keys are appended to
// ownerEditedFacets.
export const PUT = withOwner(async ({ id, request }) => {
  const gate = await requireEntitlement(
    id,
    (e) => e.canEditFacets,
    "Editing facets requires the Verified plan.",
  );
  if (gate.blocked) return gate.response;

  let body: {
    disciplines?: unknown;
    trainingTypes?: unknown;
    trainingDisciplines?: unknown;
    lessonLevels?: unknown;
    policies?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  for (const k of ["disciplines", "trainingTypes", "trainingDisciplines", "lessonLevels", "policies"] as const) {
    if (body[k] !== undefined && !Array.isArray(body[k])) {
      return NextResponse.json({ error: `${k} must be an array.` }, { status: 400 });
    }
  }

  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const result = await updateDisciplines(id, {
    disciplines: arr(body.disciplines),
    trainingTypes: arr(body.trainingTypes),
    trainingDisciplines: arr(body.trainingDisciplines),
    lessonLevels: arr(body.lessonLevels),
    policies: arr(body.policies),
  });

  return NextResponse.json({ ok: true, ...result });
});
