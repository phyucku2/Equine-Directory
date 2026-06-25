import Link from "next/link";

export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <Link href={href(page - 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-emerald-300">
          ← Prev
        </Link>
      )}
      <span className="px-2 text-sm text-stone-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:border-emerald-300">
          Next →
        </Link>
      )}
    </nav>
  );
}
