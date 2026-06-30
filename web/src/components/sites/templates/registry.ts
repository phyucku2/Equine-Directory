// Template registry for the Website Builder (specs/website-builder.md §Components).
//
// Maps a `Site.templateId` → its `Template` descriptor. The renderer
// (src/components/sites/SiteRenderer.tsx) looks a template up here; the owner's
// template-picker UI (a later phase) lists `TEMPLATES` for the gallery. Adding a
// template = add its descriptor here; nothing else changes.

import type { Template } from "@/lib/sites/templates/types";
import { classicTemplate } from "./ClassicTemplate";
import { modernTemplate } from "./ModernTemplate";

/** All selectable templates, in gallery order. */
export const TEMPLATES: Template[] = [classicTemplate, modernTemplate];

/** The template used when a Site.templateId is unknown/unset. */
export const DEFAULT_TEMPLATE_ID = classicTemplate.id;

const BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/** Resolve a templateId → Template, falling back to the default when unknown. */
export function getTemplate(templateId: string | null | undefined): Template {
  return (templateId ? BY_ID[templateId] : undefined) ?? BY_ID[DEFAULT_TEMPLATE_ID];
}
