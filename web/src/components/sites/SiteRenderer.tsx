// Tenant site renderer (specs/website-builder.md §Components).
//
// Given a resolved `Site` and its `TemplateProps` content, picks the template by
// `Site.templateId` and renders it. This is the single render entry point a
// tenant route handler / page uses:
//
//   const site = await resolveSiteByHost(host);          // src/lib/sites/tenant.ts
//   const content = await getSiteContent(site.businessId, // src/lib/sites/content.ts
//     { theme: site.theme, copy: <from site.pages> });
//   return <SiteRenderer templateId={site.templateId} content={content} />;
//
// Kept tiny and prop-driven so it works as a React server component and stays
// decoupled from Prisma (callers do the loading; this only chooses + renders).

import type { ReactElement } from "react";
import type { TemplateProps } from "@/lib/sites/templates/types";
import { getTemplate } from "./templates/registry";

export interface SiteRendererProps {
  /** The Site.templateId; unknown/empty values fall back to the default template. */
  templateId: string | null | undefined;
  /** Resolved tenant content from getSiteContent(). */
  content: TemplateProps;
}

/** Render a tenant site by selecting its template and handing it the content. */
export function SiteRenderer({ templateId, content }: SiteRendererProps): ReactElement {
  const template = getTemplate(templateId);
  return template.render(content);
}
