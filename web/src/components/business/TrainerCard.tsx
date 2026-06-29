import Link from "next/link";
import Image from "next/image";
import type { PublicTrainer } from "@/lib/db/trainers";
import { trainerUrl } from "@/lib/urls";
import { facetLabel } from "@/lib/facets";

// Compact trainer card for the barn listing + the trainers index.
export function TrainerCard({
  trainer,
  businessSlug,
}: {
  trainer: PublicTrainer;
  businessSlug: string;
}) {
  return (
    <Link
      href={trainerUrl(businessSlug, trainer.slug)}
      className="group flex gap-4 rounded-2xl border border-leather/15 bg-white p-4 transition hover:border-brass hover:shadow-sm"
    >
      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-cream-dark ring-1 ring-leather/15">
        {trainer.photoUrl ? (
          <Image
            src={trainer.photoUrl}
            alt={trainer.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-leather/30">
            {trainer.name.charAt(0)}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-pine group-hover:text-brass">{trainer.name}</p>
        {trainer.disciplines.length > 0 && (
          <p className="mt-0.5 line-clamp-1 text-xs text-brass">
            {trainer.disciplines.map((d) => facetLabel("disciplines", d)).join(" · ")}
          </p>
        )}
        {trainer.bio && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{trainer.bio}</p>}
      </div>
    </Link>
  );
}
