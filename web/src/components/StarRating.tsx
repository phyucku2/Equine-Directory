import { formatRating, showRating } from "@/lib/format";

export function StarRating({
  rating,
  reviewCount,
  size = "sm",
}: {
  rating: unknown;
  reviewCount: number;
  size?: "sm" | "lg";
}) {
  if (!showRating(reviewCount)) {
    return <span className="text-xs text-slate-400">No ratings yet</span>;
  }
  const value = formatRating(rating);
  if (!value) return <span className="text-xs text-slate-400">No ratings yet</span>;
  const filled = Math.round(Number(value));
  const star = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const text = size === "lg" ? "text-base" : "text-sm";
  return (
    <span className={`inline-flex items-center gap-1 ${text}`}>
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`${star} ${i < filled ? "text-amber-400" : "text-slate-200"}`}
            fill="currentColor"
          >
            <path d="M10 1.5l2.6 5.27 5.82.846-4.21 4.104.994 5.794L10 14.99l-5.204 2.736.994-5.794L1.58 7.616l5.82-.846L10 1.5z" />
          </svg>
        ))}
      </span>
      <span className="font-semibold text-slate-800">{value}</span>
      <span className="text-slate-400">({reviewCount})</span>
    </span>
  );
}
