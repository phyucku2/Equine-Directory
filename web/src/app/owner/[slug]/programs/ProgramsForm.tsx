"use client";

import { useState } from "react";
import { PROGRAM_TYPES } from "@/lib/facets";
import type { ProgramEntry } from "@/lib/db/owner";
import { SaveBar, textInputCls } from "../_facets/ChipMultiSelect";

// Local rows carry stringified numeric fields for controlled inputs; we coerce
// on save (the server re-validates the shape anyway).
type Row = {
  id: string;
  type: string;
  name: string;
  season: string;
  price: string;
  ageRange: string;
  capacity: string;
};

function toRow(p: ProgramEntry): Row {
  return {
    id: p.id || localId(),
    type: p.type,
    name: p.name,
    season: p.season ?? "",
    price: p.price != null ? String(p.price) : "",
    ageRange: p.ageRange ?? "",
    capacity: p.capacity != null ? String(p.capacity) : "",
  };
}

function localId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blankRow(): Row {
  return {
    id: localId(),
    type: PROGRAM_TYPES[0].slug,
    name: "",
    season: "",
    price: "",
    ageRange: "",
    capacity: "",
  };
}

export function ProgramsForm({
  businessId,
  initial,
}: {
  businessId: string;
  initial: ProgramEntry[];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setStatus("idle");

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    dirty();
  }
  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    dirty();
  }
  function add() {
    setRows((rs) => [...rs, blankRow()]);
    dirty();
  }

  async function save() {
    setStatus("saving");
    setError(null);
    // Drop rows missing a name; coerce numerics. Server re-validates types/caps.
    const programs = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name.trim(),
        season: r.season.trim() || undefined,
        price: r.price.trim() === "" ? null : Number(r.price),
        ageRange: r.ageRange.trim() || undefined,
        capacity: r.capacity.trim() === "" ? null : Number(r.capacity),
      }));

    const res = await fetch(`/api/owner/businesses/${businessId}/programs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programs }),
    });
    if (res.ok) {
      setStatus("saved");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      setStatus("error");
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-leather/25 px-4 py-6 text-center text-sm text-ink/45">
          No programs yet. Add a camp, clinic, lesson program, or lease.
        </p>
      )}

      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-leather/15 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <select
              value={r.type}
              onChange={(e) => update(r.id, { type: e.target.value })}
              className="rounded-lg border border-leather/20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            >
              {PROGRAM_TYPES.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="rounded-lg border border-leather/20 px-2.5 py-1.5 text-xs font-medium text-ink/55 transition hover:border-red-300 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-semibold text-ink/50">Name</span>
            <input
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              placeholder="e.g. Summer Horsemanship Camp"
              className={textInputCls}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Season</span>
              <input
                value={r.season}
                onChange={(e) => update(r.id, { season: e.target.value })}
                placeholder="e.g. June–August"
                className={textInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">
                Age range
              </span>
              <input
                value={r.ageRange}
                onChange={(e) => update(r.id, { ageRange: e.target.value })}
                placeholder="e.g. 8–14"
                className={textInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Price ($)</span>
              <input
                type="number"
                min={0}
                value={r.price}
                onChange={(e) => update(r.id, { price: e.target.value })}
                placeholder="e.g. 350"
                className={textInputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-ink/50">Capacity</span>
              <input
                type="number"
                min={0}
                value={r.capacity}
                onChange={(e) => update(r.id, { capacity: e.target.value })}
                placeholder="e.g. 12"
                className={textInputCls}
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded-lg border border-leather/20 px-4 py-2 text-sm font-medium text-pine transition hover:border-brass/50"
      >
        + Add program
      </button>

      <SaveBar status={status} error={error} label="Save programs" onSave={save} />
    </div>
  );
}
