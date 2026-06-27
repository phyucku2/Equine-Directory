"use client";

import { useState } from "react";

export function ClaimForm({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/businesses/${businessId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerName: form.get("ownerName"),
        ownerEmail: form.get("ownerEmail"),
        ownerPhone: form.get("ownerPhone"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Something went wrong.");
      return;
    }
    setStatus("done");
    setNotice(
      data.message ??
        "We've emailed a verification link to the listing's contact address. Open it to confirm ownership.",
    );
    setVerifyUrl(data.verifyUrl ?? null); // present only in non-production
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Claim submitted ✓</p>
        <p className="mt-1">{notice}</p>
        {verifyUrl && (
          <a href={verifyUrl} className="mt-2 inline-block break-all font-medium text-emerald-700 underline">
            {verifyUrl}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="ownerName" className="block text-sm font-medium text-stone-700">Your name</label>
        <input id="ownerName" name="ownerName" required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label htmlFor="ownerEmail" className="block text-sm font-medium text-stone-700">Email</label>
        <input id="ownerEmail" name="ownerEmail" type="email" required className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label htmlFor="ownerPhone" className="block text-sm font-medium text-stone-700">Phone (optional)</label>
        <input id="ownerPhone" name="ownerPhone" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}
