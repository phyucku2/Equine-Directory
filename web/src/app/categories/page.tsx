import { redirect } from "next/navigation";
import { categoryUrl } from "@/lib/urls";
import { STABLES_SLUG } from "@/lib/db/business";

// V1: the directory is stables/barns only, so there's no multi-category index.
// Send /categories straight to the stables hub.
export default function CategoriesIndexPage() {
  redirect(categoryUrl(STABLES_SLUG));
}
