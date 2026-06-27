import { notFound } from "next/navigation";
import { loadOwnedBusiness } from "../_shared";
import { HoursForm } from "./HoursForm";

export const dynamic = "force-dynamic";

export default async function OwnerHoursPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await loadOwnedBusiness(slug);
  if (!business) notFound();

  const hours = business.hoursOfOperation as { weekdayDescriptions?: string[] } | null;
  const initial = Array.isArray(hours?.weekdayDescriptions) ? hours.weekdayDescriptions : [];

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-pine">Hours of operation</h3>
      <p className="mb-5 text-xs text-ink/50">
        Shown on your public listing. Leave a day blank to mark it closed.
      </p>
      <HoursForm businessId={business.id} initial={initial} />
    </div>
  );
}
