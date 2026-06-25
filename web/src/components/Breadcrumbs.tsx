import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo/jsonld";

export interface Crumb {
  name: string;
  url: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
      <JsonLd data={breadcrumbLd(items)} />
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.url} className="flex items-center gap-1">
              {isLast ? (
                <span className="font-medium text-stone-700" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.url} className="hover:text-emerald-700 hover:underline">
                    {item.name}
                  </Link>
                  <span aria-hidden className="text-stone-300">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
