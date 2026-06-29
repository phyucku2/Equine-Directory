"use client";

import { useState } from "react";
import { ChipMultiSelect, FacetSection, SaveBar } from "../_facets/ChipMultiSelect";

// Trainer policy slugs owned by this tab (open vs closed barn). The rest of the
// policies array is owned by the Facility tab and preserved server-side.
const TRAINER_POLICY_SLUGS = ["open-barn", "closed-barn"];

export function DisciplinesForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: {
    disciplines: string[];
    trainingTypes: string[];
    trainingDisciplines: string[];
    lessonLevels: string[];
    policies: string[];
  };
}) {
  const [disciplines, setDisciplines] = useState<string[]>(initial.disciplines);
  const [trainingTypes, setTrainingTypes] = useState<string[]>(initial.trainingTypes);
  const [trainingDisciplines, setTrainingDisciplines] = useState<string[]>(
    initial.trainingDisciplines,
  );
  const [lessonLevels, setLessonLevels] = useState<string[]>(initial.lessonLevels);
  const [trainerPolicy, setTrainerPolicy] = useState<string[]>(
    initial.policies.filter((p) => TRAINER_POLICY_SLUGS.includes(p)),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setStatus("idle");

  async function save() {
    setStatus("saving");
    setError(null);
    const res = await fetch(`/api/owner/businesses/${businessId}/disciplines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplines,
        trainingTypes,
        trainingDisciplines,
        lessonLevels,
        policies: trainerPolicy,
      }),
    });
    if (res.ok) {
      setStatus("saved");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <FacetSection title="Disciplines accepted (for boarding)">
        <ChipMultiSelect
          facet="disciplines"
          value={disciplines}
          onChange={(v) => {
            setDisciplines(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection title="Training services offered">
        <ChipMultiSelect
          facet="trainingTypes"
          value={trainingTypes}
          onChange={(v) => {
            setTrainingTypes(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection title="Disciplines you train">
        <ChipMultiSelect
          facet="trainingDisciplines"
          value={trainingDisciplines}
          onChange={(v) => {
            setTrainingDisciplines(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection title="Lesson programs">
        <ChipMultiSelect
          facet="lessonLevels"
          value={lessonLevels}
          onChange={(v) => {
            setLessonLevels(v);
            dirty();
          }}
        />
      </FacetSection>

      <FacetSection
        title="Trainer policy"
        hint="Can boarders bring an outside trainer, or is it in-house only?"
      >
        <ChipMultiSelect
          facet="policies"
          only={TRAINER_POLICY_SLUGS}
          value={trainerPolicy}
          onChange={(v) => {
            setTrainerPolicy(v);
            dirty();
          }}
        />
      </FacetSection>

      <SaveBar status={status} error={error} label="Save disciplines" onSave={save} />
    </div>
  );
}
