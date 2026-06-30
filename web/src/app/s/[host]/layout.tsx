// Layout for the tenant site route group (specs/website-builder.md §Architecture).
//
// A tenant site is the BARN's brand, not ours: this layout renders the matched
// template bare, with none of the directory chrome. The template itself emits a
// fully self-contained, theme-driven page (header / hero / sections / footer via
// src/components/sites/templates/*), so this layout intentionally adds nothing
// around `children`.
//
// NOTE: the app's root layout (src/app/layout.tsx) still provides <html>/<body>;
// when tenant traffic is rewritten here, the directory Header/Footer it renders
// should be made tenant-aware (or the root chrome moved into a (directory) route
// group) by the layout-owning phase. This file owns only the tenant subtree.

import type { ReactNode } from "react";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return children;
}
